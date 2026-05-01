import fs from 'fs';

async function finalAudit() {
  const csvData = fs.readFileSync('C:/Users/bruce/Downloads/avh_raw_data.csv', 'utf-8');
  const lines = csvData.split('\n').slice(1);

  const titles = lines.map(l => l.split(',')[0].replace(/"/g, '')).filter(t => t.length > 5);
  
  // Sort by length to find the most complex ones
  const longTitles = titles.sort((a, b) => b.length - a.length).slice(0, 20);

  console.log('--- Top 20 Most Complex/Longest Titles (Structural Edge Cases) ---');
  longTitles.forEach((t, i) => console.log(`${i+1}. ${t}\n`));
}

finalAudit();
