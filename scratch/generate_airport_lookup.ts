import fs from 'fs';
import path from 'path';

const rawPath = path.join(process.cwd(), 'C:\\Users\\bruce\\.gemini\\antigravity\\brain\\3cea9dfa-b34d-4671-ba49-b7a0d0c25b43\\.system_generated\\steps\\2673\\content.md');
const rawContent = fs.readFileSync(rawPath, 'utf8');

// Skip the header lines in the content.md
const jsonStart = rawContent.indexOf('[');
const jsonContent = rawContent.substring(jsonStart);

const airports = JSON.parse(jsonContent);
const lookup: Record<string, string> = {};

airports.forEach((a: any) => {
  if (a.iata && a.name) {
    // Basic mapping: "London Heathrow" -> "LHR"
    lookup[a.name.toLowerCase()] = a.iata;
    
    // City-based mapping: "London" -> "LHR" (Risky but helpful for AVHerald)
    // We only take the first word if it's a major airport name
    const city = a.name.split(' ')[0].toLowerCase();
    if (a.size === 'large' && !lookup[city]) {
      lookup[city] = a.iata;
    }
  }
});

// Hard-coded tactical overrides for AVHerald specifics
const overrides: Record<string, string> = {
  "london heathrow": "LHR",
  "london gatwick": "LGW",
  "new york jfk": "JFK",
  "newark": "EWR",
  "boston": "BOS",
  "chicago": "ORD",
  "los angeles": "LAX",
  "sao paulo": "GRU",
  "dubai": "DXB",
  "paris cdg": "CDG",
  "frankfurt": "FRA",
  "amsterdam": "AMS",
  "singapore": "SIN",
  "hong kong": "HKG",
  "tokyo": "NRT"
};

const finalLookup = { ...lookup, ...overrides };

fs.writeFileSync(
  path.join(process.cwd(), 'src/constants/airport_lookup.json'),
  JSON.stringify(finalLookup, null, 2)
);

console.log(`✅ [HUD] Airport lookup table generated with ${Object.keys(finalLookup).length} entries.`);
