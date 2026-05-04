import React, { useState, useEffect } from 'react';
import ManifestStack from './components/ManifestStack';
import GlobeScene from './components/GlobeScene';
import Clock from './components/Clock';
import type { ManifestCardData, FlightPath } from './components/ManifestStack';
import patterns from './constants/aviation_patterns.json';
import { extractAirlinesFromText } from './utils/fuzzyLookup';
import { extractAirportsFromText } from './utils/airportLookup';
import { extractLocationsFromText } from './utils/locationExtractor';

// Pre-sort patterns to avoid redundant work in every hydration call
const SORTED_AIRCRAFT = [...patterns.aircraft].sort((a, b) => b.length - a.length);

// ── Module-level pure helpers (defined once, not recreated per render) ────────

const valOrUnk = (val: any): string | null => {
  if (!val) return null;
  const v = String(val).toUpperCase().trim();
  if (v === 'UNKNOWN' || v === 'UNK' || v === 'N/A' || v === '-') return null;
  return v;
};

const extractTags = (text: string): string[] => {
  const tags: string[] = [];
  const t = text.toUpperCase();
  if (t.includes('FIRE')) tags.push('FIRE');
  if (t.includes('SMOKE') || t.includes('FUMES') || t.includes('ODOUR')) tags.push('SMOKE');
  if (t.includes('ENGINE')) tags.push('ENGINE');
  if (t.includes('MEDICAL')) tags.push('MEDICAL');
  if (t.includes('TYRE') || t.includes('GEAR') || t.includes('BRAKE') || t.includes('TIRE')) tags.push('GEAR');
  if (t.includes('BIRD')) tags.push('BIRD STRIKE');
  if (t.includes('HYDRAULIC')) tags.push('HYDRAULIC');
  if (t.includes('DIVERT') || t.includes('DIVERSION')) tags.push('DIVERSION');
  return tags;
};

const getUniqueList = (val: any, metaVal: any, headVals: string[]): string[] => {
  const raw = [
    ...(Array.isArray(val) ? val : [val]),
    ...(Array.isArray(metaVal) ? metaVal : [metaVal]),
    ...headVals
  ];
  const clean = raw.map(v => valOrUnk(v)).filter(Boolean).map(v => String(v).toUpperCase());
  const sorted = [...new Set(clean)].sort((a, b) => b.length - a.length);
  const unique: string[] = [];
  for (const s of sorted) {
    if (s === 'OPERATOR' || s === 'AIRCRAFT' || s === 'UNKNOWN') continue;
    if (!unique.some(u => u.includes(s))) unique.push(s);
  }
  return unique.length > 0 ? unique : ['UNKNOWN'];
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("HUD CRITICAL ERROR:", error, errorInfo); }
  render() {
    if (this.state.hasError) return <div style={{ background: '#000', color: '#f00', padding: '20px', fontFamily: 'monospace' }}>TACTICAL SYSTEM FAILURE - RESTARTING...</div>;
    return this.props.children;
  }
}

interface IncidentMeta {
  operator?: string;
  operator_code?: string | string[];
  aircraft_type?: string;
  departure?: string;
  destination?: string;
  metar?: string;
  narrative?: string;
  severity?: string;
  airport_icao?: string;
}

interface RawIncident {
  id?: string | number;
  source_id?: string | number;
  headline?: string;
  operator?: string;
  aircraft_type?: string;
  date?: string;
  occurred_at?: string;
  lastUpdated?: string;
  last_updated?: string;
  metar?: string;
  narrative?: string;
  status?: string;
  occurrenceCategory?: string[];
  meta?: IncidentMeta;
  departure?: string;
  destination?: string;
}

const App: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<ManifestCardData[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  
  // Global cache for extraction results to prevent redundant fuzzy matching across syncs
  const extractionCache = React.useRef<Map<string, ManifestCardData>>(new Map());

  const parseAviationDate = (dateStr: any): number => {
    if (!dateStr) return 0;
    const s = String(dateStr).toUpperCase();
    // Remove ordinal suffixes: 2ND -> 2, 1ST -> 1
    const cleaned = s.replace(/(\d+)(ST|ND|RD|TH)/g, '$1');
    const d = new Date(cleaned);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  // Tactical Frontend Hydration – Two-Stage Pipeline
  // Stage 1: Extract & mask locations (airports, cities, proximity phrases)
  // Stage 2: Extract airlines from the MASKED text (preventing city→airline confusion)
  const hydrateFromHeadline = (headline: string) => {
    const findAircraft = (sortedList: string[], text: string): string[] => {
      const matches: string[] = [];
      const upperText = text.toUpperCase();
      // Use a tracked-position approach to avoid infinite loops
      for (const item of sortedList) {
        if (item.length < 3) continue;
        const upperItem = item.toUpperCase();
        let searchFrom = 0;
        while (true) {
          const idx = upperText.indexOf(upperItem, searchFrom);
          if (idx === -1) break;
          matches.push(item);
          searchFrom = idx + upperItem.length; // Advance past match, never re-scan
        }
      }
      return matches;
    };

    const aircraft = findAircraft(SORTED_AIRCRAFT, headline);

    // Stage 1 – Location extraction: extract all airports/cities and produce a
    // masked headline where those tokens are replaced with spaces.
    const locationResult = extractLocationsFromText(headline);
    const fullPath = locationResult.iatas.length > 0
      ? locationResult.iatas
      : extractAirportsFromText(headline); // fallback for explicit IATA-only headlines
    const airport = fullPath.length > 0 ? fullPath[0] : 'UNKNOWN';

    // Stage 2 – Airline extraction on the masked text only
    const detectedAirlines = extractAirlinesFromText(locationResult.maskedText);

    return { airlines: detectedAirlines, aircraft, airport, fullPath };
  };

  const fetchIncidents = async () => {
    try {
      let data: RawIncident[] = [];
      try {
        const resp = await fetch('/data/incidents.json?t=' + Date.now());
        if (resp.ok) data = await resp.json();
      } catch (e) {
        console.warn('Live incident feed unavailable, using cache/seed only.');
      }
      
      const seedResp = await fetch('/data/incidents_seed.json');
      const seedData: RawIncident[] = seedResp.ok ? await seedResp.json() : [];
      
      const mergedMap = new Map<string, RawIncident>();
      
      if (Array.isArray(data)) {
        data.forEach((item) => {
          const id = String(item.source_id || item.id || `LIVE-${Math.random().toString(36).substr(2, 9)}`).toUpperCase();
          mergedMap.set(id, item);
        });
      }

      if (Array.isArray(seedData)) {
        seedData.forEach((seed) => {
          const id = String(seed.source_id || seed.id || `SEED-${Math.random().toString(36).substr(2, 9)}`).toUpperCase();
          const existing = mergedMap.get(id);
          
          if (existing) {
            const mergedMeta = { ...existing.meta, ...seed.meta };
            mergedMap.set(id, { ...existing, ...seed, meta: mergedMeta });
          } else {
            mergedMap.set(id, seed);
          }
        });
      }

      const sortedList = Array.from(mergedMap.entries()).sort(([, a], [, b]) => {
        const dateA = parseAviationDate(a.occurred_at || a.date);
        const dateB = parseAviationDate(b.occurred_at || b.date);
        return dateB - dateA;
      });

      const formatted: ManifestCardData[] = sortedList.map(([sId, inc]) => {
        // Use cache if this source ID + headline hasn't changed
        const cacheKey = `${sId}_${inc.headline || ''}`;
        if (extractionCache.current.has(cacheKey)) {
          return extractionCache.current.get(cacheKey)!;
        }

        const rawTags = Array.isArray(inc.occurrenceCategory) ? inc.occurrenceCategory : [];
        const detectedTags = extractTags((inc.headline || '') + ' ' + (inc.narrative || inc.meta?.narrative || ''));
        const finalTags = [...new Set([...rawTags.map((s) => String(s).toUpperCase()), ...detectedTags])].filter(t => t !== 'INCIDENT' && t !== 'ACCIDENT' && t !== 'CRASH' && t !== 'NEWS');

        const headInfo = hydrateFromHeadline(inc.headline || '');

        
        const finalAircraft = getUniqueList(inc.aircraft_type, inc.meta?.aircraft_type, headInfo.aircraft);
        
        // Total aircraft count = seed data + headline extracted (union, deduplicated)
        const totalAircraftCount = Math.max(
          finalAircraft.filter(a => a !== 'UNKNOWN').length,
          headInfo.aircraft.length,
          1 // always allow at least 1 operator
        );

        // Mutual exclusion already done in hydrateFromHeadline via masking.
        // Additional guard: skip any extracted airline whose code equals an identified airport.
        const filteredHeadAirlines = headInfo.airlines.filter(a => {
          const code = (a.iata || a.icao || '').toUpperCase();
          return !headInfo.fullPath.includes(code);
        });

        const associatedAirlines = filteredHeadAirlines.slice(0, totalAircraftCount);

        // Build operator map: code → name  (code-aware deduplication)
        const opMap = new Map<string, string>();
        associatedAirlines.forEach(a => {
          const code = (a.iata && a.iata !== '-') ? a.iata : (a.icao && a.icao !== '-') ? a.icao : null;
          if (code) {
            if (!opMap.has(code) || a.name.length > (opMap.get(code) || '').length) opMap.set(code, a.name);
          } else {
            opMap.set(a.name, a.name);
          }
        });

        // Seed/scraper operators: highest priority – always add unless they are airport codes
        const seedOps = [
          ...(Array.isArray(inc.operator) ? inc.operator : [inc.operator]),
          ...(Array.isArray(inc.meta?.operator) ? inc.meta?.operator : [inc.meta?.operator])
        ].map(v => valOrUnk(v)).filter(v => v && v !== 'OPERATOR' && v !== 'UNKNOWN') as string[];

        seedOps.forEach(name => {
          const upper = name.toUpperCase();
          if (headInfo.fullPath.includes(upper)) return; // skip if it's an airport code
          const alreadyCovered = [...opMap.values()].some(
            v => v.toUpperCase().includes(upper) || upper.includes(v.toUpperCase())
          );
          if (!alreadyCovered) opMap.set(name, name);
        });

        const finalOperators = [...new Set(opMap.values())].sort((a, b) => b.length - a.length);
        // Guarantee non-empty
        const safeOperators = finalOperators.length > 0 ? finalOperators : ['UNKNOWN'];

        // Unified Operator Codes (IATA/ICAO) – from resolved airlines + seed metadata
        const finalOperatorCodes = [...new Set([
          ...(Array.isArray(inc.meta?.operator_code) ? inc.meta.operator_code : [inc.meta?.operator_code]),
          ...associatedAirlines.map(a => a.iata && a.iata !== '-' ? a.iata : (a.icao && a.icao !== '-' ? a.icao : null))
        ])].filter(Boolean).map(c => String(c).toUpperCase());

        // Consolidate flight paths
        const narrativeAirports = extractAirportsFromText(inc.narrative || inc.meta?.narrative || '');
        const combinedPath = [...new Set([...headInfo.fullPath, ...narrativeAirports])];
        
        const rawFlightPaths: FlightPath[] = safeOperators.map((op) => ({
          operator: op,
          route: combinedPath.length > 0 ? combinedPath : [headInfo.airport].filter(a => a !== 'UNKNOWN')
        }));

        const uniqueRoutesMap = new Map<string, string[]>();
        rawFlightPaths.forEach(fp => {
          const rKey = JSON.stringify(fp.route);
          if (!uniqueRoutesMap.has(rKey)) uniqueRoutesMap.set(rKey, []);
          uniqueRoutesMap.get(rKey)!.push(fp.operator);
        });

        const consolidatedPaths: FlightPath[] = Array.from(uniqueRoutesMap.entries()).map(([routeStr, ops]) => ({
          operator: ops.join(' / '),
          route: JSON.parse(routeStr)
        }));

        const departure = combinedPath.length > 0 ? combinedPath[0] : (valOrUnk(inc.departure) || valOrUnk(inc.meta?.departure) || headInfo.airport || 'UNKNOWN');
        const destination = combinedPath.length > 1 ? combinedPath[combinedPath.length - 1] : (valOrUnk(inc.destination) || valOrUnk(inc.meta?.destination) || headInfo.airport || 'UNKNOWN');

        const result: ManifestCardData = {
          ...inc,
          id: sId,
          source_id: sId,
          operator: safeOperators,
          operator_codes: finalOperatorCodes,
          aircraft_type: finalAircraft,
          date: String(inc.date || inc.occurred_at || 'RECENT').toUpperCase(),
          lastUpdated: String(inc.lastUpdated || inc.last_updated || inc.date || 'UNKNOWN').toUpperCase(),
          metar: String(inc.metar || inc.meta?.metar || '').toUpperCase(),
          narrative: String(inc.narrative || inc.meta?.narrative || inc.headline || 'NO NARRATIVE DATA AVAILABLE.').toUpperCase(),
          theme: String(inc.status || '').toUpperCase() === 'CRASH' || String(inc.meta?.severity || '').toLowerCase().includes('accident') ? 'theme-crash' : (inc.status === 'ACCIDENT' ? 'theme-accident' : 'theme-news'),
          occurrenceCategory: finalTags.length > 0 ? finalTags : [String(inc.meta?.severity || 'MONITORING').toUpperCase()],
          departure: String(departure).toUpperCase(),
          destination: String(destination).toUpperCase(),
          flight_paths: consolidatedPaths,
          status: inc.status || 'REPORT'
        };

        extractionCache.current.set(cacheKey, result);
        return result;
      });

      setIncidents(formatted);
    } catch (e) {
      console.error('Failed to fetch live incidents:', e);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const syncCheck = setInterval(async () => {
      try {
        const resp = await fetch('/data/automation_log.json');
        if (resp.ok) {
          const log = await resp.json();
          if (log.last_sync !== lastSync) {
            setLastSync(log.last_sync);
            fetchIncidents();
          }
        }
      } catch (e) {}
    }, 15000);
    return () => clearInterval(syncCheck);
  }, [lastSync]);

  return (
    <ErrorBoundary>
      <div className="app-container" style={{ position: 'relative', width: '100vw', height: '100vh', background: '#030304', overflow: 'hidden' }}>
        <div className="globe-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
          <GlobeScene incidents={incidents} onSelectIncident={() => {}} />
        </div>

        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 4, pointerEvents: 'none',
          display: 'block'
        }}>
          {/* Global Header Bar */}
          <div style={{ 
            position: 'absolute', top: '24px', left: '24px', right: '16px', 
            zIndex: 101, pointerEvents: 'all' 
          }}>
            <div className="thin-title" style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '0.3em' }}>\\ AVIATION COMMAND</div>
            <Clock />
          </div>

          <div style={{ 
            position: 'absolute', top: '80px', left: 0, width: '520px', height: 'calc(100% - 80px)', padding: '24px',
            display: 'flex', flexDirection: 'column', gap: '24px', pointerEvents: 'none', zIndex: 100
          }}>


            <div style={{ pointerEvents: 'all', flex: 1 }}>
              {incidents.length === 0 ? (
                <div style={{ color: 'var(--rose-red)', fontSize: '0.8rem', opacity: 0.5 }}>WAITING FOR INTEL FEED...</div>
              ) : (
                <ManifestStack incidents={incidents} selectedId={selectedId} setSelectedId={setSelectedId} />
              )}
            </div>
            
            <div style={{ position: 'absolute', bottom: '24px', left: '24px', opacity: 0.2, fontSize: '0.6rem', color: 'var(--rose-red)' }}>
              SYS_HEALTH: OPTIMAL | LINK_ACTIVE: {incidents.length > 0 ? 'TRUE' : 'FALSE'}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
