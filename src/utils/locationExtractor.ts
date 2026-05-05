import { findBestAirportMatch } from './airportLookup';

// Well-known cities/towns resolved to IATA codes.
// Resolution priority: Airport IATA (exact) → this city registry.
// NO duplicate keys allowed – TypeScript strict mode rejects them.
const CITY_TO_IATA: Record<string, string> = {
  // ── North America ─────────────────────────────────────────────
  'new york': 'JFK', 'los angeles': 'LAX', 'chicago': 'ORD', 'miami': 'MIA',
  'atlanta': 'ATL', 'dallas': 'DFW', 'denver': 'DEN', 'seattle': 'SEA',
  'phoenix': 'PHX', 'minneapolis': 'MSP', 'boston': 'BOS', 'philadelphia': 'PHL',
  'detroit': 'DTW', 'las vegas': 'LAS', 'salt lake city': 'SLC',
  'nashville': 'BNA', 'charlotte': 'CLT', 'orlando': 'MCO', 'portland': 'PDX',
  'san francisco': 'SFO', 'honolulu': 'HNL', 'anchorage': 'ANC',
  'houston': 'IAH', 'san diego': 'SAN', 'tampa': 'TPA', 'st louis': 'STL',
  'kansas city': 'MCI', 'pittsburgh': 'PIT', 'cleveland': 'CLE',
  'indianapolis': 'IND', 'columbus': 'CMH', 'baltimore': 'BWI',
  'raleigh': 'RDU', 'memphis': 'MEM', 'new orleans': 'MSY',
  'albuquerque': 'ABQ', 'tucson': 'TUS', 'jacksonville': 'JAX',
  'richmond': 'RIC', 'buffalo': 'BUF', 'hartford': 'BDL',
  // ── Canada ────────────────────────────────────────────────────
  'toronto': 'YYZ', 'montreal': 'YUL', 'vancouver': 'YVR',
  'calgary': 'YYC', 'edmonton': 'YEG', 'winnipeg': 'YWG',
  'ottawa': 'YOW', 'halifax': 'YHZ', 'quebec': 'YQB',
  // ── Latin America ─────────────────────────────────────────────
  'mexico city': 'MEX', 'cancun': 'CUN', 'guadalajara': 'GDL',
  'monterrey': 'MTY', 'sao paulo': 'GRU', 'rio de janeiro': 'GIG',
  'brasilia': 'BSB', 'belo horizonte': 'CNF', 'bogota': 'BOG',
  'medellin': 'MDE', 'cali': 'CLO', 'lima': 'LIM', 'quito': 'UIO',
  'guayaquil': 'GYE', 'santiago': 'SCL', 'buenos aires': 'EZE',
  'montevideo': 'MVD', 'asuncion': 'ASU', 'la paz': 'LPB', 'caracas': 'CCS',
  // ── Europe ────────────────────────────────────────────────────
  'london': 'LHR', 'paris': 'CDG', 'amsterdam': 'AMS', 'frankfurt': 'FRA',
  'madrid': 'MAD', 'rome': 'FCO', 'barcelona': 'BCN', 'munich': 'MUC',
  'brussels': 'BRU', 'vienna': 'VIE', 'zurich': 'ZRH', 'oslo': 'OSL',
  'stockholm': 'ARN', 'copenhagen': 'CPH', 'helsinki': 'HEL',
  'dublin': 'DUB', 'lisbon': 'LIS', 'athens': 'ATH', 'warsaw': 'WAW',
  'budapest': 'BUD', 'prague': 'PRG', 'bucharest': 'OTP', 'sofia': 'SOF',
  'zagreb': 'ZAG', 'belgrade': 'BEG', 'kyiv': 'KBP', 'kiev': 'KBP',
  'milan': 'MXP', 'venice': 'VCE', 'naples': 'NAP', 'marseille': 'MRS',
  'lyon': 'LYS', 'nice': 'NCE', 'bordeaux': 'BOD', 'toulouse': 'TLS',
  'dusseldorf': 'DUS', 'hamburg': 'HAM', 'cologne': 'CGN', 'stuttgart': 'STR',
  'manchester': 'MAN', 'birmingham': 'BHX', 'glasgow': 'GLA', 'edinburgh': 'EDI',
  'rotterdam': 'RTM', 'eindhoven': 'EIN', 'malaga': 'AGP', 'valencia': 'VLC',
  'seville': 'SVQ', 'bilbao': 'BIO', 'porto': 'OPO', 'faro': 'FAO',
  'thessaloniki': 'SKG', 'malta': 'MLA', 'valletta': 'MLA',
  'nicosia': 'LCA', 'reykjavik': 'KEF', 'luxembourg': 'LUX',
  'geneva': 'GVA', 'bern': 'BRN', 'basel': 'BSL', 'bratislava': 'BTS',
  'tirana': 'TIA', 'chisinau': 'KIV',
  // ── Russia & CIS ──────────────────────────────────────────────
  'moscow': 'SVO', 'st petersburg': 'LED', 'saint petersburg': 'LED',
  'novosibirsk': 'OVB', 'yekaterinburg': 'SVX', 'kazan': 'KZN',
  'nizhny novgorod': 'GOJ', 'chelyabinsk': 'CEK', 'omsk': 'OMS',
  'samara': 'KUF', 'rostov': 'ROV', 'ufa': 'UFA', 'krasnoyarsk': 'KJA',
  'perm': 'PEE', 'volgograd': 'VOG', 'vladivostok': 'VVO',
  'irkutsk': 'IKT', 'khabarovsk': 'KHV', 'krasnodar': 'KRR', 'sochi': 'AER',
  'yerevan': 'EVN', 'tbilisi': 'TBS', 'baku': 'GYD',
  'tashkent': 'TAS', 'almaty': 'ALA', 'astana': 'NQZ', 'nur sultan': 'NQZ',
  'bishkek': 'FRU', 'dushanbe': 'DYU', 'ashgabat': 'ASB',
  'minsk': 'MSQ', 'riga': 'RIX', 'vilnius': 'VNO', 'tallinn': 'TLL',
  // ── Middle East ───────────────────────────────────────────────
  'dubai': 'DXB', 'abu dhabi': 'AUH', 'doha': 'DOH', 'riyadh': 'RUH',
  'jeddah': 'JED', 'kuwait city': 'KWI', 'muscat': 'MCT',
  'tel aviv': 'TLV', 'amman': 'AMM', 'beirut': 'BEY',
  'tehran': 'IKA', 'baghdad': 'BGW', 'cairo': 'CAI',
  'istanbul': 'IST', 'ankara': 'ESB',
  // ── Africa ────────────────────────────────────────────────────
  'casablanca': 'CMN', 'tunis': 'TUN', 'tripoli': 'TIP', 'algiers': 'ALG',
  'rabat': 'RBA', 'marrakech': 'RAK', 'khartoum': 'KRT',
  'addis ababa': 'ADD', 'nairobi': 'NBO', 'kampala': 'EBB',
  'entebbe': 'EBB', 'dar es salaam': 'DAR', 'kigali': 'KGL',
  'bujumbura': 'BJM', 'kinshasa': 'FIH', 'brazzaville': 'BZV',
  'luanda': 'LAD', 'lagos': 'LOS', 'abuja': 'ABV', 'accra': 'ACC',
  'dakar': 'DSS', 'abidjan': 'ABJ', 'bamako': 'BKO', 'conakry': 'CKY',
  'freetown': 'FNA', 'libreville': 'LBV', 'johannesburg': 'JNB',
  'cape town': 'CPT', 'durban': 'DUR', 'harare': 'HRE', 'lusaka': 'LUN',
  'lilongwe': 'LLW', 'maputo': 'MPM', 'antananarivo': 'TNR',
  'port louis': 'MRU',
  // ── South Asia ────────────────────────────────────────────────
  'mumbai': 'BOM', 'delhi': 'DEL', 'kolkata': 'CCU', 'chennai': 'MAA',
  'bengaluru': 'BLR', 'bangalore': 'BLR', 'hyderabad': 'HYD',
  'ahmedabad': 'AMD', 'pune': 'PNQ', 'goa': 'GOI', 'kochi': 'COK',
  'kathmandu': 'KTM', 'dhaka': 'DAC', 'karachi': 'KHI',
  'lahore': 'LHE', 'islamabad': 'ISB', 'colombo': 'CMB',
  // ── Southeast Asia ────────────────────────────────────────────
  'singapore': 'SIN', 'kuala lumpur': 'KUL', 'jakarta': 'CGK',
  'bali': 'DPS', 'surabaya': 'SUB', 'manila': 'MNL', 'cebu': 'CEB',
  'bangkok': 'BKK', 'phuket': 'HKT', 'chiang mai': 'CNX',
  'ho chi minh city': 'SGN', 'saigon': 'SGN', 'hanoi': 'HAN',
  'phnom penh': 'PNH', 'vientiane': 'VTE', 'yangon': 'RGN',
  // ── East Asia – China ─────────────────────────────────────────
  'beijing': 'PEK', 'shanghai': 'PVG', 'guangzhou': 'CAN',
  'chengdu': 'CTU', 'shenzhen': 'SZX', 'wuhan': 'WUH',
  'chongqing': 'CKG', 'xian': 'XIY', 'xi an': 'XIY',
  'kunming': 'KMG', 'hangzhou': 'HGH', 'nanjing': 'NKG',
  'harbin': 'HRB', 'shenyang': 'SHE', 'dalian': 'DLC',
  'qingdao': 'TAO', 'jinan': 'TNA', 'zhengzhou': 'CGO',
  'changsha': 'CSX', 'fuzhou': 'FOC', 'xiamen': 'XMN',
  'nanchang': 'KHN', 'hefei': 'HFE', 'taiyuan': 'TYN',
  'urumqi': 'URC', 'lhasa': 'LXA', 'guiyang': 'KWE',
  'nanning': 'NNG', 'haikou': 'HAK', 'sanya': 'SYX',
  'lanzhou': 'LHW', 'changchun': 'CGQ', 'wenzhou': 'WNZ',
  'ningbo': 'NGB', 'guilin': 'KWL',
  // ── East Asia – Other ─────────────────────────────────────────
  'tokyo': 'NRT', 'osaka': 'KIX', 'nagoya': 'NGO', 'sapporo': 'CTS',
  'fukuoka': 'FUK', 'seoul': 'ICN', 'busan': 'PUS',
  'taipei': 'TPE', 'kaohsiung': 'KHH', 'hong kong': 'HKG', 'macau': 'MFM',
  // ── Oceania ───────────────────────────────────────────────────
  'sydney': 'SYD', 'melbourne': 'MEL', 'brisbane': 'BNE', 'perth': 'PER',
  'auckland': 'AKL', 'wellington': 'WLG', 'christchurch': 'CHC',
  'adelaide': 'ADL', 'darwin': 'DRW', 'cairns': 'CNS',
  // ── Airport names commonly cited ──────────────────────────────
  'heathrow': 'LHR', 'gatwick': 'LGW', 'stansted': 'STN', 'luton': 'LTN',
  'schiphol': 'AMS', 'charles de gaulle': 'CDG',
};

// Maritime bodies (Oceans, Seas, Gulfs) to prevent confusion with airlines (e.g. Atlantic Airways)
const MARITIME_BODIES = [
  'ATLANTIC', 'PACIFIC', 'INDIAN', 'ARCTIC', 'SOUTHERN',
  'MEDITERRANEAN', 'CARIBBEAN', 'CASPIAN', 'ADRIATIC', 'BALTIC', 'AEGEAN',
  'ANDAMAN', 'ARABIAN', 'BEAUFORT', 'BERING', 'CORAL', 'DEAD', 'LABRADOR',
  'RED SEA', 'RED', 'TASMAN', 'TYRRHENIAN', 'YELLOW', 'BLACK SEA', 'NORTH SEA',
  'NORWEGIAN SEA', 'CELTIC SEA', 'TASMAN SEA', 'GULF OF MEXICO', 'PERSIAN GULF',
  'BAY OF BENGAL', 'ENGLISH CHANNEL', 'STRAIT OF GIBRALTAR'
];

// Proximity signal words – location follows these words = incident site, NOT flight path
const PROXIMITY_REGEX = /\b(near|outside|close to|just outside|approaching|over|above|around|off the coast of|adjacent to|in the vicinity of|vicinity of|off|at|on approach to|on final|in|upon)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/gi;

// Route signal words – location follows these = flight path node
const ROUTE_REGEX = /\b(?:from|bound for|departing|inbound|outbound|via|heading to|diverted to|diverted into|en route to|arriving at|landed at|landed in)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/gi;

// Specific Maritime Masking – catches "OVER ATLANTIC", "OFF THE COAST OF RED SEA" etc.
const MARITIME_REGEX = new RegExp(`\\b(near|outside|over|above|around|off the coast of|off|in|at|on|into)\\s+(${MARITIME_BODIES.join('|')})`, 'gi');

export interface LocationExtractionResult {
  iatas: string[];
  maskedText: string;
  proximityLocations: string[];
}

// Pre-compute city entries sorted longest-first so partial matches favour specificity
const CITY_ENTRIES: [string, string][] = Object.entries(CITY_TO_IATA)
  .sort((a, b) => b[0].length - a[0].length);

// Module-level resolution cache: location string → IATA (or null sentinel)
const resolveCache = new Map<string, string | null>();

/**
 * Hierarchical location resolver – results are memoised for the session lifetime.
 * Resolution order: city registry → airport fuzzy match → partial city match
 */
function resolveToIATA(locationName: string): string | null {
  const lower = locationName.toLowerCase().trim();

  // Guard: skip very short tokens – they are almost certainly prepositions/articles
  if (lower.length < 3) return null;

  const cached = resolveCache.get(lower);
  if (cached !== undefined) return cached;

  // 1. Direct city registry O(1)
  const direct = CITY_TO_IATA[lower];
  if (direct) { resolveCache.set(lower, direct); return direct; }

  // 2. Airport fuzzy match (this is the expensive step – cached after first call)
  const airportMatch = findBestAirportMatch(lower, 0.88);
  if (airportMatch) { resolveCache.set(lower, airportMatch); return airportMatch; }

  // 3. Partial city match using pre-sorted entries (longest-first for specificity)
  for (const [city, iata] of CITY_ENTRIES) {
    if (lower.includes(city) || city.startsWith(lower)) {
      resolveCache.set(lower, iata);
      return iata;
    }
  }

  resolveCache.set(lower, null);
  return null;
}


/**
 * Four-pass location extractor. Returns IATA flight-path list + masked text 
 * safe for downstream airline extraction.
 */
export function extractLocationsFromText(rawText: string): LocationExtractionResult {
  const iataSet = new Set<string>(); // O(1) dedup
  const proximitySet = new Set<string>();
  let maskedText = rawText;

  const addIATA = (iata: string) => iataSet.add(iata);

  const mask = (text: string, start: number, length: number) =>
    text.substring(0, start) + ' '.repeat(length) + text.substring(start + length);

  // Pass 0 – Maritime/Oceanic phrases ("OVER ATLANTIC", "OFF RED SEA")
  // High priority – MUST mask these before airline extraction to avoid "Atlantic Airways" confusion
  {
    const re = new RegExp(MARITIME_REGEX.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawText)) !== null) {
      maskedText = mask(maskedText, m.index, m[0].length);
    }
  }

  // Pass 1 – Proximity phrases ("near Amsterdam", "at Mandera", "in Nashville")
  {
    const re = new RegExp(PROXIMITY_REGEX.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawText)) !== null) {
      const loc = m[2]?.trim();
      if (loc && loc.length >= 3) {
        const iata = resolveToIATA(loc);
        if (iata) { addIATA(iata); proximitySet.add(iata); }
      }
      maskedText = mask(maskedText, m.index, m[0].length);
    }
  }

  // Pass 2 – Route phrases ("from LHR", "diverted to CDG", "bound for Amsterdam")
  {
    const re = new RegExp(ROUTE_REGEX.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawText)) !== null) {
      const loc = m[1]?.trim();
      if (loc && loc.length >= 3) {
        const iata = resolveToIATA(loc);
        if (iata) addIATA(iata);
      }
      maskedText = mask(maskedText, m.index, m[0].length);
    }
  }

  // Pass 3 – Standalone uppercase 3-letter IATA codes (exact airport match only)
  {
    const re = /\b([A-Z]{3})\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(maskedText)) !== null) {
      const resolved = findBestAirportMatch(m[1], 1.0);
      if (resolved && !iataSet.has(resolved)) {
        addIATA(resolved);
        maskedText = mask(maskedText, m.index, m[0].length);
      }
    }
  }

  // Pass 4 – City name sweep (use pre-sorted CITY_ENTRIES, longest first)
  {
    const lowerMasked = maskedText.toLowerCase();
    for (const [city, iata] of CITY_ENTRIES) {
      const idx = lowerMasked.indexOf(city);
      if (idx !== -1) {
        addIATA(iata);
        maskedText = mask(maskedText, idx, city.length);
      }
    }
  }

  return {
    iatas: [...iataSet],
    maskedText,
    proximityLocations: [...proximitySet],
  };
}
