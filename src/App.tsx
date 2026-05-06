import React, { useState, useEffect } from 'react';
import ManifestStack from './components/ManifestStack';
import GlobeScene from './components/GlobeScene';
import Clock from './components/Clock';
import type { ManifestCardData, FlightPath } from './components/ManifestStack';
import patterns from './constants/aviation_patterns.json';
import { extractAirlinesFromText, isBlacklisted } from './utils/fuzzyLookup';
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
  flight_hex?: string;
}

const App: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<ManifestCardData[]>([]);
  const [incidentsLoaded, setIncidentsLoaded] = useState<boolean>(false);
  const [flightsLoaded, setFlightsLoaded] = useState<boolean>(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [telemetryMatch, setTelemetryMatch] = useState<boolean>(false);

  const selectedIncident = incidents.find(i => i.id === selectedId) || null;
  
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

  const extractAviationIdentifiers = (text: string): { registration: string | null; callsign: string | null } => {
    // Robust regex for international aircraft registrations (Tail Numbers)
    // International: G-ABCD, D-AIBI (Prefix-Suffix with hyphen)
    // US: N12345, N123AB (N followed by 1-5 chars, starting with a digit)
    const regRegex = /\b([A-Z]{1,2}-[A-Z0-9]{3,5}|N[1-9][0-9A-Z]{0,4})\b/gi;
    // Callsign regex: Airline prefix (2-3 chars) + Flight number (1-4 digits)
    const callsignRegex = /\b([A-Z]{2,3}\d{1,4}[A-Z]?)\b/gi;
    
    const regMatches = text.match(regRegex);
    const callMatches = text.match(callsignRegex);
    
    return {
      registration: regMatches ? regMatches[0].toUpperCase() : null,
      callsign: callMatches ? callMatches[0].toUpperCase() : null
    };
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
      
      const mergedMap = new Map<string, RawIncident>();
      
      if (Array.isArray(data)) {
        data.forEach((item) => {
          const id = String(item.source_id || item.id || `LIVE-${Math.random().toString(36).substr(2, 9)}`).toUpperCase();
          mergedMap.set(id, item);
        });
      }

      const sortedList = Array.from(mergedMap.entries()).sort(([, a], [, b]) => {
        const dateA = parseAviationDate(a.occurred_at || a.date);
        const dateB = parseAviationDate(b.occurred_at || b.date);
        return dateB - dateA;
      });

      const formatted: ManifestCardData[] = [];
      let index = 0;
      const CHUNK_SIZE = 3;

      const processChunk = () => {
        const end = Math.min(index + CHUNK_SIZE, sortedList.length);
        for (let i = index; i < end; i++) {
          const [sId, inc] = sortedList[i];
          const cacheKey = `${sId}_${inc.headline || ''}`;
          if (extractionCache.current.has(cacheKey)) {
            formatted.push(extractionCache.current.get(cacheKey)!);
            continue;
          }

          const rawTags = Array.isArray(inc.occurrenceCategory) ? inc.occurrenceCategory : [];
          const detectedTags = extractTags((inc.headline || '') + ' ' + (inc.narrative || inc.meta?.narrative || ''));
          const finalTags = [...new Set([...rawTags.map((s) => String(s).toUpperCase()), ...detectedTags])].filter(t => t !== 'INCIDENT' && t !== 'ACCIDENT' && t !== 'CRASH' && t !== 'NEWS');

          const headInfo = hydrateFromHeadline(inc.headline || '');

          const finalAircraft = getUniqueList(inc.aircraft_type, inc.meta?.aircraft_type, headInfo.aircraft);
          
          const totalAircraftCount = Math.max(
            finalAircraft.filter(a => a !== 'UNKNOWN').length,
            headInfo.aircraft.length,
            1
          );

          const filteredHeadAirlines = headInfo.airlines.filter(a => {
            const code = (a.iata || a.icao || '').toUpperCase();
            return !headInfo.fullPath.includes(code);
          });

          const associatedAirlines = filteredHeadAirlines.slice(0, totalAircraftCount);

          const opMap = new Map<string, string>();
          associatedAirlines.forEach(a => {
            const code = (a.iata && a.iata !== '-') ? a.iata : (a.icao && a.icao !== '-') ? a.icao : null;
            if (code) {
              if (!opMap.has(code) || a.name.length > (opMap.get(code) || '').length) opMap.set(code, a.name);
            } else {
              opMap.set(a.name, a.name);
            }
          });

          const seedOps = [
            ...(Array.isArray(inc.operator) ? inc.operator : [inc.operator]),
            ...(Array.isArray(inc.meta?.operator) ? inc.meta?.operator : [inc.meta?.operator])
          ].map(v => valOrUnk(v)).filter(v => v && v !== 'OPERATOR' && v !== 'UNKNOWN') as string[];

          seedOps.forEach(name => {
            const upper = name.toUpperCase();
            if (headInfo.fullPath.includes(upper)) return;
            if (isBlacklisted(name)) return;
            
            const alreadyCovered = [...opMap.values()].some(
              v => v.toUpperCase().includes(upper) || upper.includes(v.toUpperCase())
            );
            if (!alreadyCovered) opMap.set(name, name);
          });

          const finalOperators = [...new Set(opMap.values())].sort((a, b) => b.length - a.length);
          const safeOperators = finalOperators.length > 0 ? finalOperators : ['UNKNOWN'];

          const finalOperatorCodes = [...new Set([
            ...(Array.isArray(inc.meta?.operator_code) ? inc.meta.operator_code : [inc.meta?.operator_code]),
            ...associatedAirlines.map(a => a.iata && a.iata !== '-' ? a.iata : (a.icao && a.icao !== '-' ? a.icao : null))
          ])].filter(Boolean).map(c => String(c).toUpperCase());

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

          const { registration, callsign } = extractAviationIdentifiers((inc.headline || '') + ' ' + (inc.narrative || inc.meta?.narrative || ''));

          const result: ManifestCardData = {
            ...inc,
            id: sId,
            source_id: sId,
            operator: safeOperators,
            operator_codes: finalOperatorCodes,
            aircraft_type: finalAircraft,
            registration: registration,
            callsign: callsign,
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
          formatted.push(result);
        }

        index = end;
        setIncidents([...formatted]);

        if (index < sortedList.length) {
          requestAnimationFrame(processChunk);
        } else {
          setIncidentsLoaded(true);
        }
      };

      requestAnimationFrame(processChunk);
    } catch (e) {
      console.error('Failed to fetch live incidents:', e);
    }
  };

  useEffect(() => {
    // One-time cache clear to ensure new maritime logic applies to all historical records
    extractionCache.current.clear();
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
          <GlobeScene 
            selectedIncident={selectedIncident}
            onTelemetryMatch={setTelemetryMatch}
            onSelectIncident={() => {}} 
            onFlightsLoaded={() => setFlightsLoaded(true)}
          />
        </div>

        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 4, pointerEvents: 'none',
          display: 'block'
        }}>
          {/* Global Header Bar */}
          <div style={{ 
            position: 'absolute', top: 0, left: 0, right: 0, 
            zIndex: 101, pointerEvents: 'all'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '24px 24px 12px 24px'
            }}>
              <div>
                <div className="thin-title" style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '0.3em' }}>\\ AVIATION COMMAND</div>
                <Clock type="date" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <Clock type="time" />
                {incidents.length > 0 && (
                  <button 
                    onClick={() => {
                      const headers = [
                        'ID', 'DATE', 'STATUS', 'CATEGORIES', 'OPERATORS', 'OPERATOR_CODES', 
                        'AIRCRAFT', 'REGISTRATION', 'CALLSIGN', 'HEX', 'DEPARTURE', 'DESTINATION', 
                        'FLIGHT_PATH', 'NARRATIVE', 'METAR'
                      ];
                      const rows = incidents.map(inc => [
                        inc.id,
                        inc.date,
                        inc.status,
                        `"${(inc.occurrenceCategory || []).join(';')}"`,
                        `"${(inc.operator || []).join(';')}"`,
                        `"${(inc.operator_codes || []).join(';')}"`,
                        `"${(inc.aircraft_type || []).join(';')}"`,
                        inc.registration || '',
                        inc.callsign || '',
                        inc.flight_hex || '',
                        inc.departure,
                        inc.destination,
                        `"${(inc.flight_paths?.[0]?.route || []).join(';')}"`,
                        `"${(inc.narrative || '').replace(/"/g, '""')}"`,
                        `"${(inc.metar || '').replace(/"/g, '""')}"`
                      ]);
                      const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement("a");
                      const url = URL.createObjectURL(blob);
                      link.setAttribute("href", url);
                      link.setAttribute("download", `AVHERALD_EXPORT_${new Date().toISOString().split('T')[0]}.csv`);
                      link.style.visibility = 'hidden';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="hud-button"
                    style={{ padding: '4px 10px', fontSize: '0.55rem', letterSpacing: '0.08em' }}
                  >
                    EXPORT_INTEL.CSV
                  </button>
                )}
              </div>
            </div>
            <div style={{ width: '100vw', height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
          </div>

          <div style={{ 
            position: 'absolute', top: '80px', left: 0, width: '520px', height: 'calc(100% - 80px)', padding: '24px',
            display: 'flex', flexDirection: 'column', gap: '24px', pointerEvents: 'none', zIndex: 100
          }}>


            <div style={{ pointerEvents: 'all', flex: 1 }}>
              {incidents.length === 0 ? (
                <div style={{ color: 'var(--rose-red)', fontSize: '0.8rem', opacity: 0.5 }}>WAITING FOR INTEL FEED...</div>
              ) : (
                <ManifestStack 
                  incidents={incidents} 
                  selectedId={selectedId} 
                  setSelectedId={setSelectedId} 
                  hasTelemetryMatch={telemetryMatch}
                />
              )}
            </div>
            
            <div style={{ position: 'absolute', bottom: '24px', left: '24px', opacity: 0.2, fontSize: '0.6rem', color: 'var(--rose-red)' }}>
              SYS_HEALTH: OPTIMAL | LINK_ACTIVE: {incidents.length > 0 ? 'TRUE' : 'FALSE'}
            </div>
          </div>
        </div>
        {(!incidentsLoaded || !flightsLoaded) && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(3, 3, 4, 0.95)',
            backdropFilter: 'blur(12px)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: 'monospace',
            color: '#ffffff',
            letterSpacing: '0.15em'
          }}>
            <div style={{
              width: '400px',
              padding: '30px',
              border: '1px solid rgba(207, 20, 43, 0.3)',
              background: 'rgba(3, 3, 4, 0.8)',
              boxShadow: '0 0 30px rgba(207, 20, 43, 0.15)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {/* Corner brackets */}
              <div style={{ position: 'absolute', top: '-1px', left: '-1px', width: '10px', height: '10px', borderTop: '2px solid var(--rose-red)', borderLeft: '2px solid var(--rose-red)' }} />
              <div style={{ position: 'absolute', top: '-1px', right: '-1px', width: '10px', height: '10px', borderTop: '2px solid var(--rose-red)', borderRight: '2px solid var(--rose-red)' }} />
              <div style={{ position: 'absolute', bottom: '-1px', left: '-1px', width: '10px', height: '10px', borderBottom: '2px solid var(--rose-red)', borderLeft: '2px solid var(--rose-red)' }} />
              <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '10px', height: '10px', borderBottom: '2px solid var(--rose-red)', borderRight: '2px solid var(--rose-red)' }} />

              <div style={{ fontSize: '1rem', color: 'var(--rose-red)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="pulse-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--rose-red)', display: 'inline-block' }} />
                INITIALIZING NYX TACTICAL HUD...
              </div>

              <div style={{ width: '100%', height: '2px', background: 'rgba(255, 255, 255, 0.05)', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  background: 'var(--rose-red)',
                  width: !incidentsLoaded && !flightsLoaded ? '15%' : (!incidentsLoaded ? '50%' : (!flightsLoaded ? '75%' : '100%')),
                  transition: 'width 0.4s ease'
                }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.65rem', opacity: 0.8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>\\ INTEGRATING AVHERALD FEED...</span>
                  <span style={{ color: incidentsLoaded ? '#4ade80' : '#f59e0b' }}>
                    {incidentsLoaded ? 'RESOLVED' : 'SYNCHRONIZING'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>\\ CONNECTING LIVE ADS-B TELEMETRY...</span>
                  <span style={{ color: flightsLoaded ? '#4ade80' : '#f59e0b' }}>
                    {flightsLoaded ? 'RESOLVED' : 'STABILIZING LINK'}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '0.55rem', opacity: 0.4, textAlign: 'center', marginTop: '10px' }}>
                SECURE ENCRYPTED COMMUNICATIONS LINK // STANDBY
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
