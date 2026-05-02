import { Neo4jService } from '../src/services/Neo4jService.ts';

async function reset() {
  const neo4j = new Neo4jService();
  try {
    console.log('🧹 Clearing Neo4j database...');
    await neo4j.executeWrite('MATCH (n) DETACH DELETE n');
    console.log('✅ Database cleared.');
    await neo4j.initializeSchema();
    console.log('🏛️ Schema initialized.');
  } finally {
    await neo4j.close();
    process.exit(0);
  }
}

reset();
