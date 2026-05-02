export interface FlightState {
  hex: string;
  flight: string;
  lat: number;
  lon: number;
  alt_geom: number;
  alt_baro: number;
  track: number; // heading
  gs: number; // ground speed
}

export class ADSBTelemetryService {
  // Fetch live flights within a radius (NM) of a coordinate (default NYC)
  static async getLiveFlights(lat = 40.7128, lon = -74.0060, radiusNm = 250): Promise<FlightState[]> {
    try {
      const response = await fetch(`/api/adsb/v2/point/${lat}/${lon}/${radiusNm}`);
      if (!response.ok) throw new Error(`Failed to fetch from ADSB.lol Proxy: ${response.status}`);
      const data = await response.json();
      return data.ac || [];
    } catch (error) {
      console.error('ADSB Service Error:', error);
      return [];
    }
  }

  // Fetch all live flights globally using a massive radius point query
  static async getGlobalFlights(): Promise<FlightState[]> {
    try {
      // 0/0/20000 covers the entire planet
      const response = await fetch('/api/adsb/v2/point/0/0/20000');
      if (!response.ok) throw new Error(`Failed to fetch from ADSB.lol Proxy: ${response.status}`);
      const data = await response.json();
      return data.ac || [];
    } catch (error) {
      console.error('ADSB Global Service Error:', error);
      return [];
    }
  }
}
