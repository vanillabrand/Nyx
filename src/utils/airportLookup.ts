import airportData from '../constants/airport_lookup.json';
import { getStringSimilarity } from './fuzzyLookup';

const lookup: Record<string, string> = airportData as Record<string, string>;

// Optimization: Pre-index for O(1) exact matches
const nameIndex = new Map<string, string>();
export const iataCodeSet = new Set<string>(); // exported for cross-checking in airline extractor

Object.entries(lookup).forEach(([name, iata]) => {
  nameIndex.set(name.toLowerCase(), iata);
  iataCodeSet.add(iata.toUpperCase());
});

// Blacklist common words and month abbreviations that might be mistaken for airports
const BLACKLIST = new Set([
  'AND', 'THE', 'FOR', 'WITH', 'FROM', 'MAY', 'NEAR', 'OVER', 'WAS', 'REPORTED', 'STATED', 'SAID',
  'INCIDENT', 'ACCIDENT', 'CRASH', 'ENGINE', 'PROBLEM', 'FAILURE', 'DIVERSION', 'DIVERTS', 'DIVERTED',
  'LANDING', 'TAKEOFF', 'FLIGHT', 'AIRCRAFT', 'OPERATOR', 'PILOT', 'CREW', 'PASSENGER', 'PASSENGERS',
  'ATLANTIC', 'PACIFIC', 'OCEAN', 'SEA', 'GROUND', 'AIR', 'FIRE', 'SMOKE', 'ODOUR', 'BURNING',
  'JAN', 'FEB', 'MAR', 'APR', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  'LEFT', 'RIGHT', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'LEVEL', 'ALTITUDE', 'SPEED', 'KNOTS', 'FEET',
  'DELTA', 'UNITED', 'AMERICAN', 'SOUTHWEST', 'JETBLUE', 'SPIRIT', 'FRONTIER', 'ALASKA', 'HAWAIIAN',
  'AZUL', 'GOL', 'LATAM', 'AVIANCA', 'LUFTHANSA', 'BRITISH', 'AIRWAYS', 'RYANAIR', 'EASYJET',
  'DEP', 'ARR', 'ALT', 'SPD',
]);

/**
 * Finds the best matching airport IATA code for a given name or city.
 */
export function findBestAirportMatch(input: string, threshold: number = 0.9): string | null {
  const upperInput = input.toUpperCase().trim();
  if (upperInput.length < 3 || BLACKLIST.has(upperInput)) return null;

  const lowerInput = input.toLowerCase().trim();

  // 1. Exact match on Name/City (O(1))
  const exact = nameIndex.get(lowerInput);
  if (exact) return exact;

  // 2. Exact match on IATA code (O(1))
  if (upperInput.length === 3 && iataCodeSet.has(upperInput)) {
    return upperInput;
  }

  // 3. Fuzzy match – only if threshold allows it
  if (threshold > 0.95) return null;

  let bestMatch: string | null = null;
  let highestScore = 0;

  for (const name in lookup) {
    if (Math.abs(name.length - lowerInput.length) > 12) continue;
    const score = getStringSimilarity(lowerInput, name);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = lookup[name];
    }
    if (highestScore > 0.95) break;
  }

  return highestScore >= threshold ? bestMatch : null;
}

/**
 * Extracts multiple airports from a text, preserving order and removing duplicates.
 * NOTE: Prefer using locationExtractor.ts for headline parsing - this function is 
 * kept for narrative/metadata scanning only.
 */
export function extractAirportsFromText(text: string): string[] {
  const found: string[] = [];
  const words = text.split(/[\s,:/&-]+/).filter(w => w.length >= 3);

  for (let i = 0; i < words.length; i++) {
    // Try 3-word phrase first, then 2, then 1 (sliding window)
    for (let len = 3; len >= 1; len--) {
      if (i + len > words.length) continue;
      const phrase = words.slice(i, i + len).join(' ');
      const match = findBestAirportMatch(phrase, 0.92);

      if (match) {
        if (found.length === 0 || found[found.length - 1] !== match) {
          found.push(match);
        }
        i += len - 1;
        break;
      }
    }
  }

  return found;
}
