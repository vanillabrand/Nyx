import { ScraperOrchestrator } from '../src/services/ScraperOrchestrator.ts';
import { ScrapeMission } from '../scrapers/proanglelos/PayloadSchema.ts';

async function runTest() {
  const orchestrator = new ScraperOrchestrator();

  const mission: ScrapeMission = {
    mission_id: "LARGE_SCALE_TEST_001",
    targets: [
      "https://avherald.com/h?search_term=engine+failure",
      "https://avherald.com/h?search_term=Boeing+737+MAX",
      "https://avherald.com/h?search_term=bird+strike",
      "https://avherald.com/?page=1"
    ],
    engine_config: {
      depth_per_url: 1,      // 1 page for verification
      concurrency: 15,       // 15 parallel threads
      timeout_ms: 10000,
      retry_limit: 3
    },
    extraction_mode: "FULL",
    output_settings: {
      format: "json",
      path: "./data/scrapes"
    }
  };

  console.log(`[Test] 🚀 Launching Large Scale Smart Mission...`);
  try {
    const results = await orchestrator.executeSmartMission(mission);
    console.log(`[Test] ✨ Mission completed. ${results.length} new records hydrated and ingested.`);
  } catch (error) {
    console.error(`[Test] ❌ Mission failed:`, error);
  } finally {
    process.exit(0);
  }
}

runTest();
