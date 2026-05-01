import fs from 'fs';

async function monitorMega() {
  const filePath = 'C:/Users/bruce/Will_Flight_Query_Analyser/mega_titles_sample.txt';
  
  if (!fs.existsSync(filePath)) {
    console.log('Waiting for file...');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const titles = content.split('\n').filter(t => t.length > 5);
  const total = titles.length;

  console.log(`Analyzing ${total} new records...`);

  const audits = {
    total,
    diversions: titles.filter(t => /divert|return|diversion/i.test(t)).length,
    multiEntities: titles.filter(t => / and | & | collided | with /i.test(t)).length,
    groundDamage: titles.filter(t => /truck|tractor|car|vehicle|building|missile|fire/i.test(t)).length,
    medical: titles.filter(t => /ill|incapacitated|faint|sick|death/i.test(t)).length,
    technical: titles.filter(t => /failure|malfunction|broken|fault/i.test(t)).length
  };

  console.log('\n--- Real-Time Audit Summary ---');
  console.log(JSON.stringify(audits, null, 2));

  // Find most "Complex" titles in the new batch
  const complex = titles.sort((a, b) => b.length - a.length).slice(0, 5);
  console.log('\n--- Complex Modern Samples ---');
  complex.forEach(c => console.log(`- ${c}`));
}

monitorMega();
