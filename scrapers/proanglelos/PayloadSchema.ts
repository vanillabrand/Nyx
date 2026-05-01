export type ExtractionMode = 'LEAN' | 'FULL' | 'AUDIT';

export interface EngineConfig {
  depth_per_url: number;
  concurrency: number;
  timeout_ms: number;
  retry_limit: number;
}

export interface OutputSettings {
  format: 'json' | 'json-stream' | 'csv';
  path: string;
}

export interface ScrapeMission {
  mission_id: string;
  targets: string[]; // Comma-separated strings or array
  engine_config: EngineConfig;
  extraction_mode: ExtractionMode;
  output_settings: OutputSettings;
}

export interface ScrapedIncident {
  source_id: string;
  occurred_at: string;
  headline: string;
  url: string;
  source: string;
  meta?: {
    aircraft_type?: string;
    operator?: string;
    location?: string;
    status?: string;
    narrative?: string;
    metar?: string;
  };
}
