import React, { useRef, useState } from 'react';
import AirlineLogo from './AirlineLogo';
import EventIcon from './EventIcon';
import { CategoryIcon } from './CategoryIcon';

export interface FlightPath {
  operator: string;
  route: string[]; // Ordered list of airport codes/names
}

export interface ManifestCardData {
  id: string;
  source_id: string;
  operator: string[];
  operator_codes?: string[];
  aircraft_type: string[];
  date: string;
  status: string;
  theme: string;
  occurrenceCategory: string[];
  narrative: string;
  departure: string;
  destination: string;
  flight_paths?: FlightPath[];
  metar?: string;
  location?: string;
  lastUpdated?: string;
  registration?: string | null;
  callsign?: string | null;
}

interface ManifestStackProps {
  incidents: ManifestCardData[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  hasTelemetryMatch?: boolean;
}

const ManifestStack: React.FC<ManifestStackProps> = ({ incidents, selectedId, setSelectedId, hasTelemetryMatch }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState(0);

  const cards = incidents || [];
  const selectedCard = cards.find(c => c.id === selectedId);

  const handleWheel = (e: React.WheelEvent) => {
    if (selectedId) return;
    
    const container = containerRef.current;
    const content = scrollRef.current;
    if (container && content) {
      const maxScroll = Math.min(0, container.clientHeight - content.scrollHeight - 100);
      setScrollPos(prev => {
        const next = prev - e.deltaY;
        return Math.max(maxScroll, Math.min(0, next));
      });
    }
  };

  const renderCardContent = (card: ManifestCardData, isFocused: boolean) => (
    <div 
      onClick={(e) => {
        if (isFocused) {
          e.stopPropagation();
        } else {
          setSelectedId(card.id);
        }
      }}
      style={{ 
        width: isFocused ? '380px' : '192px', 
        height: isFocused ? 'auto' : '210px',
        position: 'relative',
        cursor: isFocused ? 'default' : 'pointer'
      }}
    >
      <div
        className={`manifest-card ${card.theme} ${isFocused ? 'focused-card' : ''}`}
        style={{ 
          width: isFocused ? '380px' : '320px',
          height: isFocused ? 'auto' : '350px',
          transform: isFocused ? 'none' : 'scale(0.60)',
          transformOrigin: 'top left',
          position: isFocused ? 'relative' : 'absolute',
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
            <div style={{ display: 'flex', gap: '20px' }}>
              {(card.occurrenceCategory || []).map((cat, idx) => (
                <div key={idx} style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <div style={{ opacity: 0.9 }}>
                    <CategoryIcon category={cat} size={24} color="var(--rose-red)" />
                  </div>
                  <div style={{ 
                    fontSize: '0.5rem', 
                    fontWeight: 900, 
                    letterSpacing: '0.1em', 
                    color: 'white',
                    opacity: 0.5,
                    textAlign: 'center'
                  }}>
                    {cat}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.55rem', opacity: 0.4, textTransform: 'uppercase' }}>{card.lastUpdated || 'UPDATED'}</div>
              <div style={{ fontSize: '0.55rem', opacity: 0.4, textTransform: 'uppercase' }}>{card.lastUpdated || 'TIMESTAMP'}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--rose-red)' }}>{card.date}</div>
            </div>
          </div>

          {/* Row 2: Central Identity (Centered Logo/Name) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', filter: 'drop-shadow(0 0 10px rgba(207,20,43,0.25))', flexWrap: 'wrap', justifyContent: 'center', color: 'var(--rose-red)' }}>
              {card.operator.map((op, idx) => (
                <AirlineLogo key={idx} operator={op} size={card.operator.length > 1 ? 48 : 64} />
              ))}
            </div>
            <div className="header-text" style={{ 
              fontSize: '2.4rem', 
              fontWeight: 900, 
              lineHeight: 1, 
              letterSpacing: '0.05em', 
              textAlign: 'center',
              width: '100%',
              color: 'var(--rose-red)'
            }}>
              {card.operator_codes && card.operator_codes.length > 0 
                ? card.operator_codes.join(' / ') 
                : (card.operator.length > 0 && card.operator[0] !== 'UNKNOWN' 
                  ? card.operator.join(' / ') 
                  : 'UNK')}
            </div>
            
            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--rose-red)', 
              opacity: 0.75, 
              marginTop: '4px', 
              letterSpacing: '0.1em', 
              textAlign: 'center',
              fontWeight: 700,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {card.operator.join(' / ')}
            </div>

            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--rose-red)',
              opacity: 0.55, 
              marginTop: '12px', 
              letterSpacing: '0.2em', 
              textAlign: 'center',
              fontWeight: 600
            }}>
              {card.aircraft_type.join(' + ')}
            </div>
          </div>

          {/* Row 3: Mission Flight Path */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              {card.flight_paths && card.flight_paths.length > 0 ? (
                card.flight_paths.map((path, pIdx) => (
                  <div key={pIdx}>
                    <div style={{ fontSize: '0.45rem', opacity: 0.4, marginBottom: '2px', display: 'flex', gap: '8px' }}>
                      <span style={{ letterSpacing: '0.1em' }}>FLIGHT_PATH {card.flight_paths!.length > 1 ? `#${pIdx + 1}` : ''}</span>
                      {card.flight_paths!.length > 1 && path.operator && (
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>[{path.operator}]</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {path.route.map((node, nIdx) => (
                        <React.Fragment key={nIdx}>
                          <span style={{ 
                            fontSize: '1.1rem', 
                            fontWeight: 900, 
                            color: 'var(--rose-red)',
                            letterSpacing: '0.05em'
                          }}>
                            {node}
                          </span>
                          {nIdx < path.route.length - 1 && (
                            <span style={{ opacity: 0.2, fontSize: '0.7rem' }}>▶</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div>
                  <div style={{ fontSize: '0.45rem', opacity: 0.4, marginBottom: '2px', letterSpacing: '0.1em' }}>FLIGHT_PATH_DATA</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--rose-red)', opacity: 0.3 }}>UNKNOWN</div>
                </div>
              )}
            </div>
            <div style={{ marginLeft: '16px' }}>
              <EventIcon status={card.status} size={32} />
            </div>
          </div>

          {/* Focused Details Overlay */}
          {isFocused && (
            <div style={{ marginTop: '32px', borderTop: '2px solid var(--rose-red)', paddingTop: '20px', textAlign: 'left' }}>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.6rem', opacity: 0.4, marginBottom: '8px' }}>INCIDENT_NARRATIVE</div>
                <div style={{ 
                  fontSize: '0.95rem', 
                  lineHeight: 1.6, 
                  maxHeight: 'calc(1.6em * 3 + 32px)', // 3 lines of text + 16px padding top/bottom
                  overflowY: 'auto',
                  opacity: 0.9, 
                  background: 'rgba(255,255,255,0.03)', 
                  padding: '16px', 
                  borderRadius: '4px',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'var(--rose-red) transparent'
                }}>
                  {card.narrative}
                </div>
              </div>
              
              {card.metar && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '0.6rem', opacity: 0.4, marginBottom: '8px' }}>METAR_DATA</div>
                  <code style={{ fontSize: '0.85rem', color: 'var(--rose-red)', opacity: 0.8, background: 'rgba(3, 3, 4, 0.25)', backdropFilter: 'blur(2px)', pointerEvents: 'none', padding: '12px', display: 'block', borderRadius: '4px', lineHeight: 1.4 }}>
                    {card.metar}
                  </code>
                </div>
              )}

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.4, marginBottom: '4px', letterSpacing: '0.1em' }}>SITUATIONAL AWARENESS</div>
                  <div style={{ 
                    fontSize: '0.8rem', 
                    fontWeight: 900, 
                    color: hasTelemetryMatch ? '#00ffaa' : 'var(--rose-red)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: hasTelemetryMatch ? '#00ffaa' : 'rgba(255,255,255,0.1)',
                      boxShadow: hasTelemetryMatch ? '0 0 10px #00ffaa' : 'none'
                    }} />
                    {hasTelemetryMatch ? 'LIVE TELEMETRY LINKED' : 'NO LIVE DATA MATCH'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '20px' }}>
                  {card.callsign && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.6rem', opacity: 0.4, marginBottom: '4px', letterSpacing: '0.1em' }}>CALLSIGN</div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: 'white' }}>{card.callsign}</div>
                    </div>
                  )}
                  {card.registration && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.6rem', opacity: 0.4, marginBottom: '4px', letterSpacing: '0.1em' }}>REGISTRATION</div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: 'white' }}>{card.registration}</div>
                    </div>
                  )}
                </div>
              </div>
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
