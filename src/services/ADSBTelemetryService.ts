export interface FlightState {
  hex: string;
  flight: string;
  lat: number;
  lon: number;
  alt_geom: number;
  alt_baro: number;
  track: number; // heading
  gs: number; // ground speed
  squawk?: string;
  r?: string;
  t?: string;
  vert_rate?: number;
}

// Internal: fetch with exponential backoff to absorb intermittent proxy drops
const fetchWithRetry = async (url: string, maxAttempts = 3): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
    try {
      const controller = new AbortController();
      // Abort if the proxy doesn't respond within 8 seconds
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) return response;
      // Non-2xx: don't retry — a 404 or 429 won't self-heal
      throw new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      lastError = err;
      // Only retry on network-level errors (socket hang up, proxy drop, abort)
      if (err?.name === 'AbortError' || err?.message?.includes('fetch') || err?.code === 'ECONNRESET') {
        continue; // retry
      }
      throw err; // surface unexpected errors immediately
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
      return data.ac || [];
    } catch (error: any) {
      // Only log on final failure — intermediate retries are silent
      console.warn('[ADSB] Regional feed unavailable after retries:', error?.message ?? error);
      return [];
    }
  }

  // Fetch all live flights globally (0/0/20000 covers the entire planet)
  static async getGlobalFlights(): Promise<FlightState[]> {
    try {
      const response = await fetchWithRetry('/api/adsb/v2/point/0/0/20000');
      const data = await response.json();
      return data.ac || [];
    } catch (error: any) {
      console.warn('[ADSB] Global feed unavailable after retries:', error?.message ?? error);
      return [];
    }
  }
  // Fetch a single aircraft by hex for high-frequency tracked-plane updates
  static async getFlightByHex(hex: string): Promise<FlightState | null> {
    try {
      const response = await fetchWithRetry(`/api/adsb/v2/hex/${hex}`);
      const data = await response.json();
      const ac = (data.ac || [])[0];
      return ac ?? null;
    } catch {
      return null;
    }
  }
}
