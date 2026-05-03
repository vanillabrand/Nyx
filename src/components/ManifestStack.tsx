import React, { useRef, useState } from 'react';
import AirlineLogo from './AirlineLogo';
import EventIcon from './EventIcon';

export interface ManifestCardData {
  id: string;
  source_id: string;
  operator: string;
  aircraft_type: string;
  date: string;
  status: string;
  theme: string;
  occurrenceCategory: string[];
  narrative: string;
  departure: string;
  destination: string;
  metar?: string;
  location?: string;
}

interface ManifestStackProps {
  incidents: ManifestCardData[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

const ManifestStack: React.FC<ManifestStackProps> = ({ incidents, selectedId, setSelectedId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState(0);

  const cards = incidents || [];
  const selectedCard = cards.find(c => c.id === selectedId);

  const handleWheel = (e: React.WheelEvent) => {
    if (selectedId) return;
    setScrollPos(prev => Math.min(0, prev - e.deltaY));
  };

  const renderCardContent = (card: ManifestCardData, isFocused: boolean) => (
    <div 
      onClick={() => !isFocused && setSelectedId(card.id)}
      style={{ 
        width: isFocused ? '380px' : '240px', 
        height: isFocused ? 'auto' : '262px',
        position: 'relative',
        cursor: isFocused ? 'default' : 'pointer'
      }}
    >
      <div
        className={`manifest-card ${card.theme} ${isFocused ? 'focused-card' : ''}`}
        style={{ 
          width: isFocused ? '380px' : '320px',
          height: isFocused ? 'auto' : '350px',
          transform: isFocused ? 'none' : 'scale(0.75)',
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: isFocused ? 1002 : 1,
          ...(isFocused ? { minHeight: '600px' } : {}),
          transition: 'none',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Top Highlight Badge (Topper) */}
        <div className="reflective-shine">
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0 0 L100 0 L100 100 Z" fill="currentColor" opacity="0.15" />
          </svg>
        </div>

        {/* Clinical Grid Layout (Shipping Label Style) */}
        <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', textTransform: 'uppercase' }}>
          
          {/* Row 1: Mission Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '24px' }}>
            <div>
              <div style={{ fontSize: '0.55rem', opacity: 0.4 }}>TACTICAL MISSION ID</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.1em' }}>{card.source_id}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.55rem', opacity: 0.4 }}>INTEL STATUS</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--rose-red)' }}>{card.status}</div>
            </div>
          </div>

          {/* Row 2: Central Identity (Centered Logo/Name) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ marginBottom: '16px', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.1))' }}>
              <AirlineLogo operator={card.operator} size={64} />
            </div>
            <div className="header-text" style={{ fontSize: '2.2rem', fontWeight: 900, lineHeight: 0.9, letterSpacing: '-0.03em', textAlign: 'center' }}>
              {card.operator}
            </div>
            <div style={{ fontSize: '0.85rem', opacity: 0.5, marginTop: '8px', letterSpacing: '0.2em' }}>
              {card.aircraft_type}
            </div>
          </div>

          {/* Row 3: Mission Flight Path */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
            <div>
              <div style={{ fontSize: '0.55rem', opacity: 0.4, marginBottom: '4px' }}>DEPARTURE / DESTINATION</div>
              <div style={{ 
                fontSize: '1.2rem', 
                fontWeight: 900, 
                color: 'var(--rose-red)',
                letterSpacing: '0.05em'
              }}>
                {card.departure} / {card.destination}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
              <EventIcon status={card.status} size={32} />
            </div>
          </div>

          {/* Focused Details Overlay */}
          {isFocused && (
            <div style={{ marginTop: '32px', borderTop: '2px solid var(--rose-red)', paddingTop: '20px', textAlign: 'left' }}>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.6rem', opacity: 0.4, marginBottom: '8px' }}>INCIDENT NARRATIVE_HYDRATED</div>
                <div style={{ fontSize: '0.95rem', lineHeight: 1.6, opacity: 0.9, background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '4px' }}>
                  {card.narrative}
                </div>
              </div>
              
              {card.metar && (
                <div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.4, marginBottom: '8px' }}>METAR_TELEMETRY_DATA</div>
                  <code style={{ fontSize: '0.85rem', color: 'var(--rose-red)', opacity: 0.8, background: 'rgba(0,0,0,0.3)', padding: '12px', display: 'block', borderRadius: '4px', lineHeight: 1.4 }}>
                    {card.metar}
                  </code>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Aesthetic Manifest Footer Line */}
        <div style={{ height: '4px', background: 'var(--rose-red)', opacity: 0.8 }} />
      </div>
    </div>
  );

  return (
    <>
      <div 
        ref={containerRef}
        className="grid-mask-container"
        onWheel={handleWheel}
      >
        <div 
          ref={scrollRef}
          className="grid-scroll-container"
          style={{ transform: `translateY(${scrollPos}px)`, transition: 'none' }}
        >
          {cards.map((card) => (
            <React.Fragment key={card.id}>
              {renderCardContent(card, false)}
            </React.Fragment>
          ))}
        </div>
      </div>

      {selectedId && selectedCard && (
        <div 
          className="focused-card-overlay"
          onClick={() => setSelectedId(null)}
          style={{ transition: 'none' }}
        >
          {renderCardContent(selectedCard, true)}
        </div>
      )}
    </>
  );
};

export default ManifestStack;
