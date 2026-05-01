import fs from 'fs';
import aviationPatterns from '../src/constants/aviation_patterns.json';

async function deepAnalyze() {
  const csvData = fs.readFileSync('C:/Users/bruce/Downloads/avh_raw_data.csv', 'utf-8');
  const lines = csvData.split('\n').slice(1);
  const total = lines.length;

  const edgeCases = {
    multiPlane: [] as string[],
    diversions: [] as string[],
    groundObjects: [] as string[],
    unmatchedEntities: new Map<string, number>(),
    longTitles: [] as string[],
    complexPunctuation: [] as string[]
  };

  const airlineSet = new Set(aviationPatterns.airlines.map(a => a.toLowerCase()));
  const aircraftSet = new Set(aviationPatterns.aircraft.map(ac => ac.toLowerCase()));

  for (const line of lines) {
    const rawText = line.split(',')[0].replace(/"/g, '');
    if (!rawText || rawText === 'NA') continue;

    // 1. Long titles (edge cases)
    if (rawText.length > 150) edgeCases.longTitles.push(rawText);

    // 2. Multi-plane (Two or more distinct airlines or aircraft types)
    const lower = rawText.toLowerCase();
    let aircraftFound = 0;
    aviationPatterns.aircraft.forEach(ac => {
      if (lower.includes(ac.toLowerCase())) aircraftFound++;
    });
    if (aircraftFound > 1) edgeCases.multiPlane.push(rawText);

    // 3. Diversions
    if (/divert|return|diversion|at ([^,]+) on ([^,]+)/i.test(rawText)) {
      edgeCases.diversions.push(rawText);
    }

    // 4. Ground Objects / Others
    if (/truck|car|tractor|missile|bird|animal|person|worker|mechanic|passenger/i.test(rawText)) {
      edgeCases.groundObjects.push(rawText);
    }

    // 5. Unmatched Entity Search (Potential missing constants)
    const words = rawText.split(/\s+/);
    words.forEach(w => {
      const clean = w.replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (clean.length > 4 && !airlineSet.has(clean) && !aircraftSet.has(clean)) {
        edgeCases.unmatchedEntities.set(clean, (edgeCases.unmatchedEntities.get(clean) || 0) + 1);
      }
    });
  }

  console.log('--- Deep Local Analysis (30,540 Records) ---');
  console.log(`Total Records: ${total}`);
  console.log(`Multi-Plane Detected: ${edgeCases.multiPlane.length}`);
  console.log(`Diversion Patterns: ${edgeCases.diversions.length}`);
  console.log(`Ground/Human Entities: ${edgeCases.groundObjects.length}`);
  
  console.log('\n--- Complex Multi-Plane Samples ---');
  console.log(edgeCases.multiPlane.slice(0, 10));

  console.log('\n--- Longest Title (Max Edge Case) ---');
  console.log(edgeCases.longTitles.sort((a, b) => b.length - a.length)[0]);

  console.log('\n--- Top Unmatched Words (Potential New Categories) ---');
  const sortedUnmatched = Array.from(edgeCases.unmatchedEntities.entries())
    .sort((a, b) => b[1] - a[1])
    .filter(([word]) => !['flight', 'landing', 'engine', 'aircraft', 'airport', 'takeoff', 'near'].includes(word))
    .slice(0, 20);
  console.log(sortedUnmatched);
}

deepAnalyze();
