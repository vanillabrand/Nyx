import neo4j, { Driver, Session } from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

export class Neo4jService {
  private driver: Driver;

  constructor() {
    // Defaulting to local instance for initial setup
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'password';
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password), { encrypted: 'ENCRYPTION_OFF' });
  }

  async close() {
    await this.driver.close();
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

  /**
   * Initializes the database with constraints and indices for O(1)/O(log N) performance
   */
  async initializeSchema() {
    const constraints = [
      'CREATE CONSTRAINT IF NOT EXISTS FOR (a:Aircraft) REQUIRE a.tailNumber IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (at:AircraftType) REQUIRE at.icaoCode IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (al:Airline) REQUIRE al.icaoCode IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (ap:Airport) REQUIRE ap.icaoCode IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (i:Incident) REQUIRE i.uuid IS UNIQUE',
      'CREATE INDEX IF NOT EXISTS FOR (i:Incident) ON (i.eventDate)',
      'CREATE INDEX IF NOT EXISTS FOR (sr:SourceRecord) ON (sr.url)'
    ];

    for (const cypher of constraints) {
      await this.executeWrite(cypher);
    }
    console.log('Neo4j schema constraints and indices initialized.');
  }
}
