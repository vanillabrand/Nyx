import { ProAngelos_ParallelScraper } from '../../scrapers/proanglelos/ProAngelos_ParallelScraper.ts';
import type { ScrapeMission } from '../../scrapers/proanglelos/PayloadSchema.ts';
import { Neo4jService } from './Neo4jService.ts';

export class ScraperOrchestrator {
  private neo4j: Neo4jService;

  constructor() {
    this.neo4j = new Neo4jService();
  }

  /**
   * Orchestrates a "Smart Hunt"
   * 1. Performs a LEAN scrape to identify available records.
   * 2. Checks Neo4j for existing/fresh records.
   * 3. Performs a FULL scrape only for new or stale records.
   */
  async executeSmartMission(mission: ScrapeMission) {
    console.log(`[Orchestrator] 🧠 Initiating Smart Mission: ${mission.mission_id}`);

    // Step 1: Lean Scrape to get IDs
    const leanMission: ScrapeMission = {
      ...mission,
      mission_id: `${mission.mission_id}_DISCOVERY`,
      extraction_mode: 'LEAN'
    };

    const discovery = new ProAngelos_ParallelScraper(leanMission);
    const discoveredRecords = await discovery.execute();

    if (discoveredRecords.length === 0) {
      console.log(`[Orchestrator] 📭 No records found for mission.`);
      return [];
    }

    // Step 2: Check for existing IDs in the Graph
    const discoveredIds = discoveredRecords.map(r => r.source_id);
    const existingIds = await this.neo4j.getExistingIncidentIds(discoveredIds);

    // Step 3: Identify the "Delta" (Missing records)
    const deltaIds = discoveredIds.filter(id => !existingIds.includes(id));
    
    console.log(`[Orchestrator] 📊 Status: ${discoveredIds.length} found, ${existingIds.length} already in graph, ${deltaIds.length} new.`);

    if (deltaIds.length === 0) {
      console.log(`[Orchestrator] ☕ All records current. No further action needed.`);
      return [];
    }

    // Step 4: Full Scrape only for Delta
    const deltaTargets = discoveredRecords
      .filter(r => deltaIds.includes(r.source_id))
      .map(r => r.url);

    const deltaMission: ScrapeMission = {
      ...mission,
      mission_id: `${mission.mission_id}_DELTA_HYDRATION`,
      targets: deltaTargets,
      engine_config: {
        ...mission.engine_config,
        depth_per_url: 1 
      },
      extraction_mode: 'FULL'
    };

    const hydration = new ProAngelos_ParallelScraper(deltaMission);
    const hydratedRecords = await hydration.execute();

    // Step 5: Trigger Ingestion
    await this.neo4j.bulkIngestIncidents(hydratedRecords);

    return hydratedRecords;
  }
}
