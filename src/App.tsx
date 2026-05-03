import React, { useState, useEffect } from 'react';
import ManifestStack from './components/ManifestStack';
import GlobeScene from './components/GlobeScene';
import Clock from './components/Clock';
import type { ManifestCardData } from './components/ManifestStack';
import patterns from './constants/aviation_patterns.json';

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

const App: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<ManifestCardData[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Tactical Frontend Hydration (Fallback for Scraper failures)
  const hydrateFromHeadline = (headline: string) => {
    const findEntity = (list: string[], text: string) => {
      let bestMatch = null;
      let earliestPos = Infinity;
      for (const item of list) {
        if (item.length < 3) continue;
        const idx = text.toUpperCase().indexOf(item.toUpperCase());
        if (idx !== -1 && idx < earliestPos) {
          earliestPos = idx;
          bestMatch = item;
        }
      }
      return bestMatch;
    };

    const aircraft = findEntity(patterns.aircraft, headline) || 'AIRCRAFT';
    const airline = findEntity(patterns.airlines, headline) || 'OPERATOR';
    return { airline, aircraft };
  };

  const fetchIncidents = async () => {
    try {
      let data = [];
      try {
        const resp = await fetch('/data/incidents.json?t=' + Date.now());
        if (resp.ok) data = await resp.json();
      } catch (e) {}
      
      // Merge with Hardened Seed for 100% Reliability
      const seedResp = await fetch('/data/incidents_seed.json');
      const seedData = seedResp.ok ? await seedResp.json() : [];
      
      // Unique merge (Latest data wins)
      const mergedMap = new Map();
      [...seedData, ...data].forEach(item => {
        const id = String(item.source_id || item.id).toUpperCase();
        mergedMap.set(id, { ...mergedMap.get(id), ...item });
      });

      const formatted = Array.from(mergedMap.values()).map((inc: any) => {
        const sId = String(inc.source_id || inc.id).toUpperCase();
        const headInfo = hydrateFromHeadline(inc.headline || '');
        
        return {
          ...inc,
          id: sId,
          source_id: sId,
          operator: String(inc.operator || inc.meta?.operator || headInfo.airline).toUpperCase(),
          aircraft_type: String(inc.aircraft_type || inc.meta?.aircraft_type || headInfo.aircraft).toUpperCase(),
          date: String(inc.date || inc.occurred_at || 'RECENT').toUpperCase(),
          metar: String(inc.metar || inc.meta?.metar || '').toUpperCase(),
          narrative: String(inc.narrative || inc.meta?.narrative || inc.headline || 'NO NARRATIVE DATA AVAILABLE.').toUpperCase(),
          theme: String(inc.status || '').toUpperCase() === 'CRASH' || String(inc.meta?.severity || '').toLowerCase().includes('accident') ? 'theme-crash' : (inc.status === 'ACCIDENT' ? 'theme-accident' : 'theme-news'),
          occurrenceCategory: Array.isArray(inc.occurrenceCategory) ? inc.occurrenceCategory.map((s: any) => String(s).toUpperCase()) : [String(inc.meta?.severity || 'MONITORING').toUpperCase()],
          departure: String(inc.departure || inc.meta?.departure || 'UNKNOWN').toUpperCase(),
          destination: String(inc.destination || inc.meta?.destination || 'UNKNOWN').toUpperCase()
        };
      });

      formatted.sort((a: any, b: any) => {
        const dateA = new Date(a.date).getTime() || 0;
        const dateB = new Date(b.date).getTime() || 0;
        return dateB - dateA;
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

        <div className="ui-overlay" style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 4, pointerEvents: 'none',
          display: 'grid', gridTemplateColumns: '520px 1fr 300px', gap: '24px'
        }}>
          <div style={{ 
            position: 'absolute', top: 0, left: 0, width: '520px', height: '100%', padding: '24px',
            display: 'flex', flexDirection: 'column', gap: '24px', pointerEvents: 'none', zIndex: 100
          }}>
            <div style={{ pointerEvents: 'all' }}>
              <div className="thin-title" style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '0.3em' }}>\\ AVIATION COMMAND</div>
              <Clock />
            </div>

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
