import neo4j, { Driver, Session } from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

export class Neo4jService {
  private driver: Driver;

  constructor() {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'password';
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password), { encrypted: 'ENCRYPTION_OFF' });
  }

  /**
   * Initializes the database with constraints and indices for O(1) performance
   */
  async initializeSchema() {
    const session = this.driver.session();
    try {
      const queries = [
        'CREATE CONSTRAINT IF NOT EXISTS FOR (i:Incident) REQUIRE i.source_id IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (a:AircraftType) REQUIRE a.icaoCode IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (al:Airline) REQUIRE al.name IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (ap:Airport) REQUIRE ap.icaoCode IS UNIQUE',
        'CREATE INDEX IF NOT EXISTS FOR (i:Incident) ON (i.occurred_at)',
        'CREATE INDEX IF NOT EXISTS FOR (i:Incident) ON (i.severity)'
      ];
      for (const q of queries) {
        await session.run(q);
      }
      console.log('[Neo4j] 🏛️ Schema constraints and indices initialized.');
    } finally {
      await session.close();
    }
  }

  async getExistingIncidentIds(ids: string[]): Promise<string[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (i:Incident) WHERE i.source_id IN $ids RETURN i.source_id as id',
        { ids }
      );
      return result.records.map(record => record.get('id'));
    } finally {
      await session.close();
    }
  }

  async bulkIngestIncidents(incidents: any[]) {
    const session = this.driver.session();
    try {
      await session.run(`
        UNWIND $batch AS data
        MERGE (i:Incident {source_id: data.source_id})
        SET i.headline = data.headline,
            i.occurred_at = data.occurred_at,
            i.url = data.url,
            i.narrative = data.meta.narrative,
            i.metar = data.meta.metar,
            i.severity = data.meta.severity,
            i.last_updated = timestamp()

        // Link to Aircraft Type
        FOREACH (ignore IN CASE WHEN data.meta.aircraft_type IS NOT NULL THEN [1] ELSE [] END |
          MERGE (at:AircraftType {icaoCode: data.meta.aircraft_type})
          MERGE (i)-[:INVOLVED_AIRCRAFT]->(at)
        )

        // Link to Airline
        FOREACH (ignore IN CASE WHEN data.meta.operator IS NOT NULL THEN [1] ELSE [] END |
          MERGE (al:Airline {name: data.meta.operator})
          MERGE (i)-[:OPERATED_BY]->(al)
        )

        // Link to Airport (ICAO Code)
        FOREACH (ignore IN CASE WHEN data.meta.airport_icao IS NOT NULL THEN [1] ELSE [] END |
          MERGE (ap:Airport {icaoCode: data.meta.airport_icao})
          MERGE (i)-[:OCCURRED_AT]->(ap)
        )
      `, { batch: incidents });
      console.log(`[Neo4j] 💉 Successfully ingested ${incidents.length} records into the Knowledge Graph.`);
      return incidents.length;
    } finally {
      await session.close();
    }
  }

  async executeWrite(cypher: string, params: any = {}) {
    const session: Session = this.driver.session();
    try {
      return await session.executeWrite(tx => tx.run(cypher, params));
    } finally {
      await session.close();
    }
  }

  async executeRead(cypher: string, params: any = {}) {
    const session: Session = this.driver.session();
    try {
      return await session.executeRead(tx => tx.run(cypher, params));
    } finally {
      await session.close();
    }
  }

  async close() {
    await this.driver.close();
  }
}
