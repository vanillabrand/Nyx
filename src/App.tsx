import React, { useState, useEffect } from 'react';
import GlobeScene from './components/GlobeScene.tsx';
import ManifestStack from './components/ManifestStack.tsx';

const App: React.FC = () => {
  // const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Model state for the stack with accurate 'EVENT_DATE' from headlines
  const [incidents] = useState<any[]>([
    {
      id: 'CR-5389793',
      operator: 'DELTA AIR LINES',
      aircraft: 'AIRBUS A321-211',
      departure: 'MSP',
      arrival: 'MKE',
      status: 'CRASH',
      theme: 'theme-crash',
      time: '14:22',
      date: 'APR 26, 2026', // Extracted from headline
      metar: 'KMSP 261422Z 33012G20KT 10SM BKN045 12/02 Q1012',
      occurrenceCategory: ['FIRE', 'SMOKE', 'ENGINE'],
      narrative: 'Sudden loss of altitude at FL320. Crew reported severe smoke and fire on board. Tactical asset loss confirmed.'
    },
    {
      id: 'AC-5362bc2',
      operator: 'JETBLUE AIRWAYS',
      aircraft: 'AIRBUS A321-271NX',
      departure: 'JFK',
      arrival: 'ORD',
      status: 'ACCIDENT',
      theme: 'theme-accident',
      time: '09:45',
      date: 'APR 17, 2026', // Extracted from headline
      metar: 'KJFK 170945Z 18008KT 9SM FEW025 15/09 Q1018',
      occurrenceCategory: ['ODOUR', 'PAX_SAFETY'],
      narrative: 'Odour in cabin reported during descent. Crew donned oxygen masks and initiated priority landing at ORD.'
    },
    {
      id: 'NW-536954b',
      operator: 'PORTER AIRLINES',
      aircraft: 'EMBRAER E195-E2',
      departure: 'YEG',
      arrival: 'YYZ',
      status: 'INCIDENT',
      theme: 'theme-news',
      time: '22:10',
      date: 'FEB 22, 2026', // Extracted from headline
      metar: 'CYEG 222210Z AUTO 00000KT 15SM SKC M10/M15 Q1025',
      occurrenceCategory: ['TYRE', 'LANDING'],
      narrative: 'Passenger observed tyre separating on departure. Crew elected to return to YEG for precautionary landing.'
    },
    {
      id: 'NEW-999',
      operator: 'UNITED AIRLINES',
      aircraft: 'BOEING 737-800',
      departure: 'DEN',
      arrival: 'LAX',
      status: 'MONITORING',
      theme: 'theme-news',
      time: '07:30',
      date: 'MAY 01, 2026',
      source_id: '999',
      metar: 'KDEN 010730Z 24015KT 10SM SCT080 18/04 Q1015',
      occurrenceCategory: ['MONITORING', 'TECHNICAL'],
      narrative: 'Unidentified technical discrepancy reported in Denver sector. Monitoring telemetry.',
      isNew: true
    }
  ]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Automation Sync Polling
    const syncCheck = setInterval(async () => {
      try {
        const resp = await fetch('/data/automation_log.json');
        if (resp.ok) {
          const log = await resp.json();
          console.log('🔄 [Sync] Background automation status:', log.status);
        }
      } catch (e) { /* silent fail */ }
    }, 60000);

    return () => {
      clearInterval(timer);
      clearInterval(syncCheck);
    };
  }, []);

  const handleSelectIncident = (_incident: any) => {
    // const _found = incidents.find(i => i.id === incident.source_id);
    // if (_found) setSelectedIncident(_found);
  };

  return (
    <div className="app-container" style={{ position: 'relative', width: '100vw', height: '100vh', background: '#030304' }}>

      {/* Background Globe */}
      <div className="globe-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
        <GlobeScene incidents={incidents} onSelectIncident={handleSelectIncident} />
      </div>

      {/* UI Overlays: Tactical HUD */}
      <div className="ui-overlay" style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 4,
        pointerEvents: 'none',
        padding: 'var(--p-lg)',
        display: 'grid',
        gridTemplateColumns: 'calc(20vw - 40px) 1fr 300px',
        gridTemplateRows: 'auto 1fr auto',
        gap: 'var(--gap-lg)'
      }}>

        {/* Top Left: Mission Headers */}
        <div style={{ gridColumn: '1', display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'all' }}>
          <div className="thin-title" style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '0.3em' }}>\\ AVIATION COMMAND</div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginTop: '4px',
            whiteSpace: 'nowrap'
          }}>
            <div className="header-text" style={{ fontSize: '1.2rem', color: 'var(--rose-red)', letterSpacing: '0.05em', paddingRight: '15px' }}>
              {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
            </div>
            <div style={{ width: '1px', height: '1.5rem', background: 'var(--rose-red)', opacity: 0.5 }}></div>
            <div className="header-text" style={{ fontSize: '1.25rem', color: 'var(--rose-red)', letterSpacing: '0.05em', fontWeight: 900 }}>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
          </div>
        </div>

        {/* Top Right: Status Info - REMOVED */}
        <div style={{ gridColumn: '3' }}></div>

        {/* Left Side: Manifest Rolling Grid */}
        <div style={{ gridRow: '2', gridColumn: '1', pointerEvents: 'all', display: 'flex', alignItems: 'center' }}>
          <ManifestStack 
            incidents={incidents} 
            selectedId={selectedId}
            setSelectedId={setSelectedId}
          />
        </div>

      </div>
    </div>
  );
};

export default App;
