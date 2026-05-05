const TEST_HEXES = new Set([
  '00000000', 'FFFFFFFF', 'ABCD1234', '1234ABCD', '11111111', 
  '77777777', '99999999', 'FEEDFACE', 'DEADBEEF', 'CAFEBABE',
  '7777XBEG', 'FFMRPN1', '49F08D', '2237FFFF', '00000001'
]);

export interface FlightState {
  hex: string;
  type?: string;
  flight?: string;
  r?: string;
  t?: string;
  alt_baro?: number;
  alt_geom?: number;
  gs?: number;
  track?: number;
  lat: number;
  lon: number;
  squawk?: string;
  category?: string;
  seen?: number;
  messages?: number;
}

// Internal: fetch with exponential backoff to absorb intermittent proxy drops
let circuitBreakerTripped = false;
let lastFailureTime = 0;
const CIRCUIT_RESET_MS = 90000; // Increased to 90s to absorb persistent proxy instability

const fetchWithRetry = async (url: string, maxAttempts = 2): Promise<Response> => {
  if (circuitBreakerTripped && Date.now() - lastFailureTime < CIRCUIT_RESET_MS) {
    throw new Error('Circuit Breaker: Proxy Connection Suspended');
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (response.ok) {
        circuitBreakerTripped = false;
        return response;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || '';
      // If we hit a protocol or proxy-level crash, trip the circuit breaker
      if (msg.includes('SSL') || msg.includes('CONNECT') || msg.includes('EPROTO') || msg.includes('socket')) {
        circuitBreakerTripped = true;
        lastFailureTime = Date.now();
        break; 
      }
      continue;
    }
  }

  throw lastError ?? new Error('Max retries exceeded');
};

export class ADSBTelemetryService {
  // Fetch live flights within a radius (NM) of a coordinate
  static async getLiveFlights(lat = 40.7128, lon = -74.0060, radiusNm = 250): Promise<FlightState[]> {
    try {
      const response = await fetchWithRetry(`/api/adsb/v2/point/${lat}/${lon}/${radiusNm}`);
      const data = await response.json();
      const ac = (data.ac || []) as FlightState[];
      return ac.filter(f => f.hex && !TEST_HEXES.has(f.hex.toUpperCase()) && f.lat !== undefined && f.lon !== undefined);
    } catch (error: any) {
      console.warn('[ADSB] Regional feed unavailable:', error?.message ?? error);
      return [];
    }
  }

  // Fetch all live flights globally (0/0/20000 covers the entire planet)
  static async getGlobalFlights(): Promise<FlightState[]> {
    try {
      const response = await fetchWithRetry('/api/adsb/v2/point/0/0/20000');
      const data = await response.json();
      const ac = (data.ac || []) as FlightState[];
      return ac.filter(f => f.hex && !TEST_HEXES.has(f.hex.toUpperCase()) && f.lat !== undefined && f.lon !== undefined);
    } catch (error: any) {
      console.warn('[ADSB] Global feed unavailable:', error?.message ?? error);
      return [];
    }
  }
  // Fetch a single aircraft by hex for high-frequency tracked-plane updates
  static async getFlightByHex(hex: string): Promise<FlightState | null> {
    if (!hex) return null;
    try {
      const response = await fetchWithRetry(`/api/adsb/v2/hex/${hex}`);
      const raw = await response.json();
      const aircraft = (raw.aircraft || []) as FlightState[];
      // Strictly filter out test/mock hexes and invalid positions
      return aircraft.filter(f => f.hex && !TEST_HEXES.has(f.hex.toUpperCase()) && f.lat !== undefined && f.lon !== undefined)[0] ?? null;
    } catch {
      return null;
    }
  }
}
