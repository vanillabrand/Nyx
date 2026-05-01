import fs from 'fs';
import { Neo4jService } from '../src/services/Neo4jService';
import { AviationHeraldScraper } from '../src/services/AviationHeraldScraper';
import bootstrapData from '../src/constants/bootstrap_data.json';

async function bulkIngest() {
  const csvPath = 'C:/Users/bruce/Downloads/avh_raw_data.csv';
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').slice(1); // Skip header

  const neo4j = new Neo4jService();
  await neo4j.initializeSchema();

  console.log(`Starting bulk ingestion of ${lines.length} records...`);

  const batchSize = 500;
  let processed = 0;

  for (let i = 0; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, i + batchSize);
    const parsedBatch = batch.map(line => {
      // Handle quoted CSV cells
      const parts = line.match(/(".*?"|[^,]+)/g);
      if (!parts || parts.length < 2) return null;

      const rawText = parts[0].replace(/"/g, '').trim();
      const reportDate = parts[1].trim();

      if (rawText === 'NA' || rawText.includes('Get the news right') || rawText.length < 10) {
        return null;
      }

      const structured = AviationHeraldScraper.parseTitle(rawText);
      return {
        ...structured,
        rawText,
        reportDate,
        uuid: Buffer.from(rawText).toString('base64').substring(0, 24) // Temporary UUID
      };
    }).filter(p => p !== null);

    if (parsedBatch.length > 0) {
      // High-performance UNWIND query
      const cypher = `
        UNWIND $batch as row
        MERGE (i:Incident {uuid: row.uuid})
        SET i.title = row.rawText,
            i.eventDateStr = row.eventDate,
            i.reportDate = row.reportDate,
            i.description = row.description
        
        FOREACH (ignoreMe IN CASE WHEN row.airline IS NOT NULL THEN [1] ELSE [] END |
          MERGE (al:Airline {name: row.airline})
          MERGE (i)-[:INVOLVED_AIRLINE]->(al)
        )
        
        FOREACH (ignoreMe IN CASE WHEN row.aircraft IS NOT NULL THEN [1] ELSE [] END |
          MERGE (at:AircraftType {icaoCode: row.aircraft})
          MERGE (i)-[:INVOLVED_AIRCRAFT]->(at)
        )
      `;

      await neo4j.executeWrite(cypher, { batch: parsedBatch });
      processed += parsedBatch.length;
      console.log(`Processed ${processed}/${lines.length} records...`);
    }
  }

  await neo4j.close();
  console.log('Bulk ingestion complete.');
}

bulkIngest();
