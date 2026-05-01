import fs from 'fs';
import path from 'path';

const rFilePath = 'C:/Users/bruce/Downloads/av_constants.R';
const outputFilePath = 'c:/Users/bruce/Will_Flight_Query_Analyser/src/constants/aviation_patterns.json';

function extractConstants() {
  const content = fs.readFileSync(rFilePath, 'utf-8');
  const patterns: any = {
    airlines: [],
    aircraft: [],
    events: {},
    parts: {},
    locations: [],
    adjectives: []
  };

  // Extract Airlines
  const airlineMatch = content.match(/AIRLINES=list\(([\s\S]*?)\n\)/);
  if (airlineMatch) {
    const airlineList = airlineMatch[1]
      .split('\n')
      .map(line => line.trim().replace(/,$/, '').replace(/^c\(/, '').replace(/\)$/, ''))
      .filter(line => line && !line.startsWith('#'))
      .map(line => line.split(',').map(s => s.trim().replace(/"/g, '')))
      .flat();
    patterns.airlines = Array.from(new Set(airlineList)).filter(a => a.length > 2);
  }

  // Extract Aircraft strings
  const aircraftBlock = content.match(/AIRCRAFT_SEARCH_STRINGS=list\(([\s\S]*?)\n\s*?\)/);
  if (aircraftBlock) {
    const allStrings = aircraftBlock[1].match(/"[^"]+"/g) || [];
    patterns.aircraft = Array.from(new Set(allStrings.map(s => s.replace(/"/g, '')))).filter(s => s.length > 1);
  } else {
    // Fallback if the regex is too strict
    const allStrings = content.match(/"[^"]+"/g) || [];
    // Just a rough heuristic to find aircraft-looking strings
    patterns.aircraft = Array.from(new Set(allStrings.map(s => s.replace(/"/g, ''))))
      .filter(s => /^[AB]\d{2,3}|[A-Z]{2,}\d*|DC\d|MD\d/.test(s));
  }

  // Extract Events
  const events1Match = content.match(/events1=list\(([\s\S]*?)\)/);
  if (events1Match) {
    const pairs = events1Match[1].match(/(\w+)=c\(([\s\S]*?)\)/g) || [];
    pairs.forEach(p => {
      const [key, vals] = p.split('=c(');
      patterns.events[key.trim()] = vals.replace(/\)/, '').split(',').map(v => v.trim().replace(/"/g, ''));
    });
  }

  // Extract Parts
  const parts1Match = content.match(/ac_parts1=list\(([\s\S]*?)\)/);
  if (parts1Match) {
    const pairs = parts1Match[1].match(/(\w+)=c\(([\s\S]*?)\)/g) || [];
    pairs.forEach(p => {
      const [key, vals] = p.split('=c(');
      patterns.parts[key.trim()] = vals.replace(/\)/, '').split(',').map(v => v.trim().replace(/"/g, ''));
    });
  }

  // Ensure directory exists
  const dir = path.dirname(outputFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(outputFilePath, JSON.stringify(patterns, null, 2));
  console.log('Extracted patterns to', outputFilePath);
}

extractConstants();
