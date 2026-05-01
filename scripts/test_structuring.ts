import fs from 'fs';
import { AviationHeraldScraper } from '../src/services/AviationHeraldScraper';

async function testStructuring() {
  const scraper = new AviationHeraldScraper();
  const csvData = fs.readFileSync('C:/Users/bruce/Downloads/avh_raw_data.csv', 'utf-8');
  const lines = csvData.split('\n').slice(1, 101); // Test first 100 lines

  console.log('Testing Title Structuring...\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    // Basic CSV split (handling quotes)
    const matches = line.match(/(".*?"|[^,]+)/g);
    if (!matches) continue;
    
    const rawText = matches[0].replace(/"/g, '');
    const structured = scraper.parseTitle(rawText);

    console.log(`RAW: ${rawText.substring(0, 80)}...`);
    console.log(`STRUCT: Carrier: ${structured.carrier}, AC: ${structured.aircraftType}, Loc: ${structured.eventLocation}, Date: ${structured.eventDate}`);
    console.log(`CATS: ${structured.eventCategories?.join(', ')} | PARTS: ${structured.affectedParts?.join(', ')}`);
    console.log('---');
  }
}

testStructuring();
