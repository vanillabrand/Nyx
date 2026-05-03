import { ProAngelos_ParallelScraper } from '../../scrapers/proanglelos/ProAngelos_ParallelScraper';
import { Neo4jService } from './Neo4jService';
import fs from 'fs';
import path from 'path';

export class AutomationService {
  private scraper: ProAngelos_ParallelScraper;
  private neo4j: Neo4jService;
  private isRunning: boolean = false;
  private logPath: string;

  constructor() {
    this.neo4j = new Neo4jService();
    this.logPath = path.join(process.cwd(), 'public', 'data', 'automation_log.json');
    
    const mission = {
      mission_id: 'AUTOMATION_SYNC',
      targets: ['https://avherald.com/h?list=&opt=0'],
      engine_config: {
        depth_per_url: 2,
        concurrency: 5,
        timeout_ms: 15000,
        retry_limit: 3
      },
      extraction_mode: 'FULL' as const,
      output_settings: {
        format: 'json' as const,
        path: './public/data/automation'
      }
    };
    
    this.scraper = new ProAngelos_ParallelScraper(mission);

    if (!fs.existsSync(path.dirname(this.logPath))) {
      fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
    }
  }

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🚀 [Automation] Mission Control started. Interval: 15m + jitter.');
    this.runCycle();
  }

  private async runCycle() {
    try {
      console.log(`📡 [Automation] Initiating scrape cycle at ${new Date().toISOString()}`);
      
      // 1. Scrape AVHerald Home
      const results = await this.scraper.execute();
      
      if (results && results.length > 0) {
        // 2. Update local state log and data for Frontend polling (Priority)
        this.updateSyncLog(results.length, results);
        console.log(`📡 [Automation] Local data stream updated with ${results.length} records.`);

        // 3. Attempt Ingest into Neo4j (Relational Schema)
        try {
          const ingestedCount = await this.neo4j.bulkIngestIncidents(results);
          console.log(`✅ [Automation] Neo4j sync complete. Ingested ${ingestedCount} records.`);
        } catch (dbError) {
          console.warn('⚠️ [Automation] Neo4j Sync failed (DB offline?), but local stream is ACTIVE.');
        }
      }
    } catch (error) {
      console.error('❌ [Automation] Cycle failed:', error);
    } finally {
      // 4. Schedule next run: 15 minutes + random jitter (0-60s)
      const jitter = Math.floor(Math.random() * 60000);
      const nextRun = 15 * 60 * 1000 + jitter;
      console.log(`⏰ [Automation] Next cycle in ${Math.round(nextRun / 1000 / 60)}m ${Math.round((nextRun % 60000) / 1000)}s`);
      setTimeout(() => this.runCycle(), nextRun);
    }
  }

  private updateSyncLog(count: number, results: any[]) {
    const log = {
      last_sync: new Date().toISOString(),
      new_items: count,
      status: 'ACTIVE'
    };
    fs.writeFileSync(this.logPath, JSON.stringify(log, null, 2));
    
    // Also save latest incidents for frontend consumption
    const incidentsPath = path.join(process.cwd(), 'public', 'data', 'incidents.json');
    fs.writeFileSync(incidentsPath, JSON.stringify(results, null, 2));
  }
}
