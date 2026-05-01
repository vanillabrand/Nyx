import fs from 'fs';

async function analyzeLocalData() {
  const csvData = fs.readFileSync('C:/Users/bruce/Downloads/avh_raw_data.csv', 'utf-8');
  const lines = csvData.split('\n').slice(1);
  const total = lines.length;

  console.log(`Analyzing ${total} local records...`);

  const patterns = {
    multiAircraft: 0,
    diversions: 0,
    collisions: 0,
    groundEntities: 0,
    technicalFailures: 0,
    humanFactors: 0,
    unusualKeywords: new Set<string>()
  };

  const sampleMulti: string[] = [];
  const sampleDiversion: string[] = [];

  for (const line of lines) {
    const rawText = line.split(',')[0].toLowerCase();
    
    if (rawText.includes(' and ') || rawText.includes(' collided with ') || rawText.includes(' & ')) {
      patterns.multiAircraft++;
      if (sampleMulti.length < 5) sampleMulti.push(line.split(',')[0]);
    }
    if (rawText.includes('diverted') || rawText.includes('diversion') || rawText.includes('return to ')) {
      patterns.diversions++;
      if (sampleDiversion.length < 5) sampleDiversion.push(line.split(',')[0]);
    }
    if (rawText.includes('truck') || rawText.includes('car') || rawText.includes('tractor') || rawText.includes('missile') || rawText.includes('animal')) {
      patterns.groundEntities++;
    }
    if (rawText.includes('failure') || rawText.includes('malfunction') || rawText.includes('broken')) {
      patterns.technicalFailures++;
    }
    if (rawText.includes('incapacitated') || rawText.includes('ill') || rawText.includes('fainted')) {
      patterns.humanFactors++;
    }
  }

  console.log('\n--- Analysis Summary ---');
  console.log(`Total Records: ${total}`);
  console.log(`Multi-Aircraft Potential: ${patterns.multiAircraft} (${((patterns.multiAircraft/total)*100).toFixed(2)}%)`);
  console.log(`Diversion Potential: ${patterns.diversions} (${((patterns.diversions/total)*100).toFixed(2)}%)`);
  console.log(`Ground Entity Potential: ${patterns.groundEntities} (${((patterns.groundEntities/total)*100).toFixed(2)}%)`);
  console.log(`Technical Failure Potential: ${patterns.technicalFailures} (${((patterns.technicalFailures/total)*100).toFixed(2)}%)`);
  console.log(`Human Factor Potential: ${patterns.humanFactors} (${((patterns.humanFactors/total)*100).toFixed(2)}%)`);
  
  console.log('\n--- Samples ---');
  console.log('Multi-Aircraft:', sampleMulti);
  console.log('Diversions:', sampleDiversion);
}

analyzeLocalData();
