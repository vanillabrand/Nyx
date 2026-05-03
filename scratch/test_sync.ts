import { ProAngelos_ParallelScraper } from '../scrapers/proanglelos/ProAngelos_ParallelScraper';
import path from 'path';
import fs from 'fs';

const mission = {
  mission_id: 'MANUAL_TEST_SYNC',
  targets: ['https://avherald.com/h?list=&opt=0'],
  engine_config: {
    depth_per_url: 1, // Just one page for testing
    concurrency: 2,
    timeout_ms: 15000,
    retry_limit: 1
  },
  extraction_mode: 'FULL' as const,
  output_settings: {
    format: 'json' as const,
    path: './public/data/automation'
  }
};

async function testScraper() {
  const scraper = new ProAngelos_ParallelScraper(mission);
  console.log('📡 Starting Manual Sync Test...');
  const results = await scraper.execute();
  
  if (results && results.length > 0) {
    console.log(`✅ Scraped ${results.length} items.`);
    const first: any = results[0];
    console.log('Sample Item Route:', first.meta?.departure, '/', first.meta?.destination);
    
    const incidentsPath = path.join(process.cwd(), 'public', 'data', 'incidents.json');
    fs.writeFileSync(incidentsPath, JSON.stringify(results, null, 2));
    console.log('💾 public/data/incidents.json updated.');

    const logPath = path.join(process.cwd(), 'public', 'data', 'automation_log.json');
    const log = {
      last_sync: new Date().toISOString(),
      new_items: results.length,
      status: 'ACTIVE'
    };
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
    console.log('📡 automation_log.json updated to trigger UI refresh.');
  } else {
    console.log('❌ No results found.');
  }
}

testScraper().catch(console.error);
