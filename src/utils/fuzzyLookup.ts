import airlineData from '../constants/airline_lookup.json';
import { iataCodeSet } from './airportLookup';

export interface Airline {
  name: string;
  alias: string;
  iata: string;
  icao: string;
  callsign: string;
  country: string;
}

const airlines: Airline[] = airlineData as Airline[];

// Optimization: Pre-index for O(1) exact matches
const nameIndex = new Map<string, Airline[]>();
const codeIndex = new Map<string, Airline[]>();

// Build the index once at module load
airlines.forEach(a => {
  if (!a || !a.name) return;

  const name = a.name.toUpperCase();
  if (!nameIndex.has(name)) nameIndex.set(name, []);
  nameIndex.get(name)!.push(a);

  if (a.alias && typeof a.alias === 'string' && a.alias !== '-' && a.alias !== 'N/A') {
    const alias = a.alias.toUpperCase();
    if (!nameIndex.has(alias)) nameIndex.set(alias, []);
    nameIndex.get(alias)!.push(a);
  }

  if (a.callsign && typeof a.callsign === 'string' && a.callsign !== '-' && a.callsign !== 'N/A') {
    const callsign = a.callsign.toUpperCase();
    if (!nameIndex.has(callsign)) nameIndex.set(callsign, []);
    nameIndex.get(callsign)!.push(a);
  }

  // Only index IATA codes (2 chars) and ICAO codes (3 chars) – never allow
  // a 3-letter airport IATA to collide with an airline ICAO
  if (a.iata && typeof a.iata === 'string' && a.iata !== '-' && a.iata.length === 2) {
    const iata = a.iata.toUpperCase();
    if (!codeIndex.has(iata)) codeIndex.set(iata, []);
    codeIndex.get(iata)!.push(a);
  }

  // ICAO airline codes are 3 uppercase letters; but ONLY add to codeIndex if the
  // code does NOT collide with an airport IATA code (cross-vector exclusion)
  if (a.icao && typeof a.icao === 'string' && a.icao !== '-' && a.icao.length === 3) {
    const icao = a.icao.toUpperCase();
    if (!iataCodeSet.has(icao)) { // Guard: skip if it's also an airport IATA
      if (!codeIndex.has(icao)) codeIndex.set(icao, []);
      codeIndex.get(icao)!.push(a);
    }
  }
});

// Linguistic blacklist – words that must NEVER be treated as airline identifiers
// via NLP extraction. Seed/scraper operators bypass this entirely.
const BLACKLIST = new Set([
  // Common English prepositions & conjunctions (prevent 'at X' → AT = Royal Air Maroc)
  'AT', 'ON', 'IN', 'BY', 'OF', 'TO', 'UP', 'AN', 'AS', 'IS', 'OUR',
  // Generic aviation words
  'AIR', 'AIRLINES', 'AIRWAY', 'AIRWAYS', 'FLIGHT', 'FLY',
  'OVER', 'NEAR', 'OUTSIDE', 'AROUND', 'ABOVE', 'CLOSE',
  // Months
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'JUNE', 'JULY', 'AUGUST',
  'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
  // Compass/geo
  'NORTH', 'SOUTH', 'EAST', 'WEST', 'ATLANTIC', 'PACIFIC',
  'INTERNATIONAL', 'REGIONAL', 'CHARTER', 'SERVICE', 'SERVICES',
  'CARGO', 'TRANSPORT', 'EXPRESS', 'CONNECTION',
  // Articles/prepositions
  'AND', 'THE', 'FOR', 'WITH', 'FROM', 'SAO', 'ALL', 'OFF', 'OUT',
  'WAS', 'ITS', 'HAD', 'HAS', 'BUT', 'NOT', 'ARE', 'ONE', 'TWO',
  'VIA', 'NON', 'STOP', 'BEEN', 'WERE', 'SAID', 'WILL',
  // Manufacturers (must never match as airline)
  'AIRBUS', 'BOEING', 'CESSNA', 'PIPER', 'EMBRAER', 'BOMBARDIER',
  'FOKKER', 'ANTONOV', 'ILLYUSHIN', 'TUPOLEV', 'YAKOVLEV',
  // Locations / cities that appear in headlines
  'AMSTERDAM', 'LONDON', 'PARIS', 'DUBAI', 'SYDNEY', 'TOKYO',
  'BEIJING', 'ATLANTA', 'CHICAGO', 'HEATHROW', 'GATWICK', 'NEWARK',
  'MALTA', 'VALLETTA', 'BOISE', 'HOUSTON', 'DENVER', 'MIAMI',
  'MOSCOW', 'ROME', 'BERLIN', 'MADRID', 'NAIROBI', 'KAMPALA',
  // Misc false-positive triggers
  'PLANE', 'JET', 'AERO', 'CONTROL', 'CENTER', 'FIRE', 'HELICOPTER',
  'HELICOPTERS', 'INTERAGENCY', 'CHIEF', 'RAT', 'CONGO', 'FINAL',
  'STATED', 'REPORTED', 'SMOKE', 'GEAR', 'BIRD', 'MEDICAL', 'ENGINE',
]);

// Bounded bigram cache to prevent memory leak
const bigramCache = new Map<string, Set<string>>();
const BIGRAM_CACHE_MAX = 2000;

/**
 * Calculates string similarity using Dice's Coefficient (Bigrams).
 * Memory-safe: evicts cache when it grows too large.
 */
export function getStringSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const getBigrams = (str: string): Set<string> => {
    const lower = str.toLowerCase();
    const cached = bigramCache.get(lower);
    if (cached) return cached;

    const bigrams = new Set<string>();
    for (let i = 0; i < lower.length - 1; i++) {
      bigrams.add(lower.substring(i, i + 2));
    }
    // Evict oldest entry if cache is full
    if (bigramCache.size >= BIGRAM_CACHE_MAX) {
      const firstKey = bigramCache.keys().next().value;
      if (firstKey !== undefined) bigramCache.delete(firstKey);
    }
    bigramCache.set(lower, bigrams);
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersect = 0;
  for (const bi of b1) {
    if (b2.has(bi)) intersect++;
  }
  return (2 * intersect) / (b1.size + b2.size);
}

/**
 * Scores an airline for tie-breaking: prefer those with valid IATA codes and 
 * from major aviation markets.
 */
function scoreAirline(a: Airline): number {
  let score = 0;
  if (a.iata && a.iata !== '-' && a.iata !== 'N/A' && a.iata.length === 2) score += 20;
  if (a.icao && a.icao !== '-' && a.icao !== 'N/A' && a.icao.length === 3) score += 10;
  const popular = ['United States', 'United Kingdom', 'Canada', 'France', 'Germany', 'Brazil', 'China', 'Japan', 'Australia'];
  if (popular.includes(a.country)) score += 5;
  return score - (a.name.length / 100);
}

function pickBest(list: Airline[]): Airline | null {
  if (list.length === 0) return null;
  return list.slice().sort((a, b) => scoreAirline(b) - scoreAirline(a))[0];
}

/**
 * Finds the best matching airline for a given name or code.
 * CRITICAL: never returns a match whose IATA/ICAO is a known airport code.
 */
export function findBestAirlineMatch(input: string, threshold: number = 0.85): Airline | null {
  const upperInput = input.toUpperCase().trim();

  // Hard guards
  if (upperInput.length < 2) return null;
  if (BLACKLIST.has(upperInput)) return null;
  // Cross-vector: if this looks like an airport IATA code, reject immediately
  if (upperInput.length === 3 && iataCodeSet.has(upperInput)) return null;

  // 1. Exact match on Name, Alias, or Callsign (O(1))
  const exact = nameIndex.get(upperInput);
  if (exact) {
    const best = pickBest(exact);
    // Validate: don't return an airline whose code is actually an airport code
    if (best && best.iata && iataCodeSet.has(best.iata.toUpperCase())) return null;
    return best;
  }

  // 2. Exact match on IATA (2-char) or ICAO (3-char, non-airport) code (O(1))
  const code = codeIndex.get(upperInput);
  if (code) return pickBest(code);

  // 3. Fuzzy match – only for phrases of 5+ chars and only when threshold allows it
  if (upperInput.length < 5) return null; // Never fuzzy-match very short tokens
  if (threshold >= 0.97) return null;     // At max threshold, require exact match only

  let bestMatch: Airline | null = null;
  let highestScore = 0;

  for (const airline of airlines) {
    const nameLen = airline.name.length;
    if (Math.abs(nameLen - upperInput.length) > 15) continue;

    const score = getStringSimilarity(upperInput, airline.name.toUpperCase());
    if (score > highestScore) {
      highestScore = score;
      bestMatch = airline;
      if (highestScore > 0.97) break; // Early exit
    }
  }

  if (highestScore >= threshold && bestMatch) {
    // Final cross-check
    if (bestMatch.iata && iataCodeSet.has(bestMatch.iata.toUpperCase())) return null;
    return bestMatch;
  }
  return null;
}

/**
 * Extracts potential airline names from a MASKED headline.
 * The caller must first run locationExtractor.ts to obtain a masked headline
 * (all locations replaced with spaces) before calling this function.
 * This prevents city names from being misidentified as airlines.
 */
export function extractAirlinesFromText(maskedText: string): Airline[] {
  const found: Airline[] = [];
  const words = maskedText.split(/[\s,:/&-]+/).filter(w => w.length >= 2);

  for (let i = 0; i < words.length; i++) {
    // Try 3-word phrase first, then 2, then 1
    for (let len = 3; len >= 1; len--) {
      if (i + len > words.length) continue;
      const phrase = words.slice(i, i + len).join(' ');

      // Single-word matches need near-exact threshold; multi-word can be lower
      const currentThreshold = len === 1 ? 0.97 : 0.93;
      const match = findBestAirlineMatch(phrase, currentThreshold);

      if (match) {
        // Deduplication: same IATA+ICAO pair, or one name contains the other
        const existingIdx = found.findIndex(f =>
          (f.iata === match.iata && f.iata !== '-') ||
          (f.icao === match.icao && f.icao !== '-') ||
          f.name.toUpperCase().includes(match.name.toUpperCase()) ||
          match.name.toUpperCase().includes(f.name.toUpperCase())
        );

        if (existingIdx === -1) {
          found.push(match);
        } else if (match.name.length > found[existingIdx].name.length) {
          // Replace with more specific/longer name
          found[existingIdx] = match;
        }

        i += len - 1;
        break;
      }
    }
  }

  return found;
}
