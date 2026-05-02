import { Neo4jService } from '../src/services/Neo4jService.ts';

async function verify() {
  const neo4j = new Neo4jService();
  try {
    console.log('🧪 Verifying Graph Topology...');
    
    const stats = await neo4j.executeRead(`
      MATCH (n)
      RETURN labels(n)[0] as label, count(n) as count
    `);
    console.log('--- Node Counts ---');
    stats.records.forEach(r => console.log(`${r.get('label')}: ${r.get('count')}`));

    const rels = await neo4j.executeRead(`
      MATCH ()-[r]->()
      RETURN type(r) as type, count(r) as count
    `);
    console.log('\--- Relationship Counts ---');
    rels.records.forEach(r => console.log(`${r.get('type')}: ${r.get('count')}`));

    const sample = await neo4j.executeRead(`
      MATCH (i:Incident)-[r1:INVOLVED_AIRCRAFT]->(at:AircraftType),
            (i)-[r2:OPERATED_BY]->(al:Airline)
      RETURN i.headline as headline, at.icaoCode as aircraft, al.name as airline
      LIMIT 3
    `);
    console.log('\--- Sample Hydrated Records ---');
    sample.records.forEach(r => {
      console.log(`Headline: ${r.get('headline')}`);
      console.log(`  -> Aircraft: ${r.get('aircraft')}`);
      console.log(`  -> Airline: ${r.get('airline')}`);
    });

  } finally {
    await neo4j.close();
    process.exit(0);
  }
}

verify();
