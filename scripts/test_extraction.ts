import patterns from '../src/constants/aviation_patterns.json' assert { type: 'json' };

const fullText = "Porter E295 at Edmonton and Toronto on Feb 22nd 2026, passenger observed tyre separating on departure";

const findEntity = (list: string[]) => {
  for (const item of list) {
    const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(fullText)) return item;
  }
  return null;
};

console.log('Testing extraction...');
console.log('Aircraft:', findEntity(patterns.aircraft));
console.log('Airline:', findEntity(patterns.airlines));

const icaoMatch = fullText.match(/\b([A-Z]{4})\b/g);
console.log('Airport ICAO:', icaoMatch ? icaoMatch[0] : null);
