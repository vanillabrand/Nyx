import React, { useRef, useEffect } from 'react';
import type { FlightState } from '../services/ADSBTelemetryService';

export interface TrackedPosition {
  x: number;
  y: number;
  visible: boolean;
}

interface FlightTrackingGridProps {
  trackedFlights: FlightState[];
  trackedPositionsRef: React.MutableRefObject<Map<string, TrackedPosition>>;
  onRemove: (hex: string) => void;
}

const MAX_TRACKED = 20;

const squawkLookup: Record<string, { label: string; color: string }> = {
  '7500': { label: 'HIJACK', color: '#ff2020' },
  '7600': { label: 'RADIO FAIL', color: '#ff8800' },
  '7700': { label: 'EMERGENCY', color: '#ff2020' },
  '2000': { label: 'IFR OCNC', color: '#dc143c' },
  '1200': { label: 'VFR', color: '#aa2030' },
  '0000': { label: 'STANDBY', color: '#882030' },
  '7777': { label: 'MILITARY', color: '#aa00ff' },
  '2200': { label: 'NO ATC', color: '#cc3020' },
  '1000': { label: 'MODE C', color: '#993030' },
};

// --- Mini Instruments ---

const MiniArcGauge = ({
  value, max, label, unit, color
}: { value: number; max: number; label: string; unit: string; color: string }) => {
  const pct = Math.min(Math.max(value / max, 0), 1);
  const r = 22; const cx = 26; const cy = 26;
  const startA = -210; const endA = 30;
  const totalDeg = endA - startA;
  const sweepDeg = pct * totalDeg;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const aStart = { x: cx + r * Math.cos(toRad(startA)), y: cy + r * Math.sin(toRad(startA)) };
  const aEnd = { x: cx + r * Math.cos(toRad(startA + sweepDeg)), y: cy + r * Math.sin(toRad(startA + sweepDeg)) };
  const bgEnd = { x: cx + r * Math.cos(toRad(endA)), y: cy + r * Math.sin(toRad(endA)) };
  const bgLarge = totalDeg > 180 ? 1 : 0;
  const largeArc = sweepDeg > 180 ? 1 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
      <svg width="52" height="46" viewBox="0 0 52 50">
        <path d={`M${aStart.x},${aStart.y} A${r},${r} 0 ${bgLarge} 1 ${bgEnd.x},${bgEnd.y}`}
          fill="none" stroke="rgba(139,10,20,0.3)" strokeWidth="3" strokeLinecap="round" />
        {sweepDeg > 0 && (
          <path d={`M${aStart.x},${aStart.y} A${r},${r} 0 ${largeArc} 1 ${aEnd.x},${aEnd.y}`}
            fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        <text x={cx} y={cy - 1} textAnchor="middle" fill="#ffaaaa" fontSize="8" fontWeight="bold" fontFamily="monospace">
          {Math.round(value)}
        </text>
        <text x={cx} y={cy + 7} textAnchor="middle" fill="rgba(220,100,100,0.5)" fontSize="5" fontFamily="monospace">
          {unit}
        </text>
      </svg>
      <div style={{ fontSize: '0.38rem', letterSpacing: '0.12em', color: 'rgba(220,80,80,0.5)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
};

const MiniCompass = ({ heading }: { heading: number }) => {
  const r = 19; const cx = 23; const cy = 23;
  const rad = (heading - 90) * Math.PI / 180;
  const nx = cx + r * 0.7 * Math.cos(rad);
  const ny = cy + r * 0.7 * Math.sin(rad);
  const nRad = (-90) * Math.PI / 180;
  const nTipX = cx + (r - 2) * Math.cos(nRad);
  const nTipY = cy + (r - 2) * Math.sin(nRad);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
      <svg width="46" height="46" viewBox="0 0 46 46">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(139,10,20,0.3)" strokeWidth="1" />
        {[0, 90, 180, 270].map(deg => {
          const a = (deg - 90) * Math.PI / 180;
          return <line key={deg}
            x1={cx + (r - 4) * Math.cos(a)} y1={cy + (r - 4) * Math.sin(a)}
            x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)}
            stroke="rgba(180,40,50,0.4)" strokeWidth="1" />;
        })}
        <text x={nTipX} y={nTipY + 2} textAnchor="middle" fill="#dc143c" fontSize="5" fontWeight="bold" fontFamily="monospace">N</text>
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#dc143c" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="1.5" fill="#ffaaaa" />
        <text x={cx} y={44} textAnchor="middle" fill="#ffaaaa" fontSize="6.5" fontWeight="bold" fontFamily="monospace">
          {Math.round(heading).toString().padStart(3, '0')}°
        </text>
      </svg>
      <div style={{ fontSize: '0.38rem', letterSpacing: '0.12em', color: 'rgba(220,80,80,0.5)', textTransform: 'uppercase' }}>HDG</div>
    </div>
  );
};

const VertRateBar = ({ fpm }: { fpm: number }) => {
  const clamped = Math.max(-3000, Math.min(3000, fpm));
  const barH = 60;
  const fillH = Math.abs(clamped / 3000) * (barH / 2);
  const isUp = clamped > 0;
  const fillY = isUp ? barH / 2 - fillH : barH / 2;
  const color = isUp ? '#8B1A1A' : clamped < 0 ? '#dc143c' : 'rgba(139,10,20,0.3)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
      <svg width="22" height="66" viewBox="0 0 22 66">
        <rect x="8" y="3" width="6" height={barH} rx="2" fill="rgba(100,5,10,0.3)" />
        <line x1="6" y1={3 + barH / 2} x2="16" y2={3 + barH / 2} stroke="rgba(180,40,50,0.4)" strokeWidth="0.5" />
        <rect x="8" y={3 + fillY} width="6" height={fillH} rx="1" fill={color} />
        <text x="11" y="2.5" textAnchor="middle" fill="rgba(180,40,50,0.4)" fontSize="5">▲</text>
        <text x="11" y="66" textAnchor="middle" fill="rgba(180,40,50,0.4)" fontSize="5">▼</text>
        <text x="11" y={3 + barH / 2 + (isUp ? -3 : 8)} textAnchor="middle"
          fill={color} fontSize="4.5" fontFamily="monospace" fontWeight="bold">
          {clamped !== 0 ? (isUp ? '+' : '') + Math.round(clamped) : '0'}
        </text>
      </svg>
      <div style={{ fontSize: '0.36rem', letterSpacing: '0.1em', color: 'rgba(220,80,80,0.5)', textTransform: 'uppercase' }}>V/S</div>
    </div>
  );
};

// --- Main Grid Component ---

const FlightTrackingGrid: React.FC<FlightTrackingGridProps> = ({ trackedFlights, trackedPositionsRef, onRemove }) => {
  const cardRefs = useRef<(HTMLDivElement | null)[]>(Array(MAX_TRACKED).fill(null));
  const svgRef = useRef<SVGSVGElement>(null);
  const linesRef = useRef<(SVGLineElement | null)[]>(Array(MAX_TRACKED).fill(null));

  // RAF loop: update SVG tracking lines each frame
  useEffect(() => {
    let rafId: number;
    const update = () => {
      if (svgRef.current) {
        const svgRect = svgRef.current.getBoundingClientRect();
        for (let i = 0; i < MAX_TRACKED; i++) {
          const flight = trackedFlights[i];
          const line = linesRef.current[i];
          const card = cardRefs.current[i];
          if (!line) continue;

          if (flight && card) {
            const pos = trackedPositionsRef.current.get(flight.hex);
            const rect = card.getBoundingClientRect();
            if (pos && pos.visible) {
              const x2 = rect.left - svgRect.left;
              const y2 = rect.top - svgRect.top;
              line.setAttribute('x1', pos.x.toString());
              line.setAttribute('y1', pos.y.toString());
              line.setAttribute('x2', x2.toString());
              line.setAttribute('y2', y2.toString());
              line.setAttribute('opacity', '0.35');
            } else {
              line.setAttribute('opacity', '0');
            }
          } else {
            line.setAttribute('opacity', '0');
          }
        }
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [trackedFlights, trackedPositionsRef]);

  // Hide entirely when no planes tracked
  if (trackedFlights.length === 0) return null;

  return (
    <>
      {/* Full-viewport SVG for tracking lines */}
      <svg ref={svgRef} style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100vh',
        pointerEvents: 'none', zIndex: 15,
        overflow: 'visible'
      }}>
        {Array.from({ length: MAX_TRACKED }).map((_, i) => (
          <line key={i} ref={el => { linesRef.current[i] = el; }}
            x1="0" y1="0" x2="0" y2="0"
            stroke="#dc143c" strokeWidth="1"
            strokeDasharray="6 5"
            opacity="0"
          />
        ))}
      </svg>

      {/* Tracking panel — scrollable 2-column grid matching left panel layout */}
      <div style={{
        position: 'fixed',
        top: '80px',
        right: '16px',
        width: '389px',
        maxHeight: 'calc(100vh - 160px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        zIndex: 20,
        pointerEvents: 'none',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(139,10,20,0.5) transparent',
      }}>
        {/* Header matching left panel style */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '8px',
          marginBottom: '8px',
          borderBottom: '1px solid rgba(139,10,20,0.4)',
          pointerEvents: 'all'
        }}>
          <div style={{
            fontSize: '0.45rem', fontWeight: 900, letterSpacing: '0.2em',
            color: 'var(--rose-red)', textTransform: 'uppercase',
            fontFamily: 'monospace'
          }}>
            ◈ TACTICAL TRACK
          </div>
          <div style={{
            fontSize: '0.42rem', color: 'rgba(207,20,43,0.5)',
            letterSpacing: '0.12em', fontFamily: 'monospace'
          }}>
            {trackedFlights.length} / {MAX_TRACKED}
          </div>
        </div>

        {/* 2-column grid — only renders actual tracked flights, no blank slots */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          width: '100%'
        }}>
          {trackedFlights.map((flight, i) => {
            const squawk = flight.squawk ? (squawkLookup[flight.squawk] ?? null) : null;
            const altFt = Math.max(flight.alt_baro ?? flight.alt_geom ?? 0, 0);

            return (
              <div
                key={flight.hex}
                ref={el => { cardRefs.current[i] = el; }}
                style={{
                  width: '100%',
                  height: '186px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  pointerEvents: 'all'
                }}
              >
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '7px 8px 6px' }}>
                  {/* ── Header ── */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    borderBottom: '1px solid rgba(100,10,15,0.4)', paddingBottom: '5px', marginBottom: '5px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.12em', color: '#ffaaaa', fontFamily: 'monospace', lineHeight: 1 }}>
                        {(flight.flight || flight.hex || '').trim()}
                      </div>
                      <div style={{ fontSize: '0.42rem', color: 'rgba(200,80,90,0.5)', letterSpacing: '0.08em', marginTop: '2px' }}>
                        {flight.r ?? '—'} · {flight.t ?? 'UNKNOWN'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      {squawk && (
                        <div style={{
                          fontSize: '0.38rem', fontWeight: 900, color: squawk.color,
                          border: `1px solid ${squawk.color}`, borderRadius: '2px', padding: '1px 3px',
                          letterSpacing: '0.08em'
                        }}>
                          {squawk.label}
                        </div>
                      )}
                      <div style={{ fontSize: '0.4rem', color: 'rgba(180,60,70,0.5)', fontFamily: 'monospace' }}>
                        {flight.squawk ? `◈ ${flight.squawk}` : '◈ ----'}
                      </div>
                      <button onClick={() => onRemove(flight.hex)} style={{
                        background: 'none', border: 'none', color: '#ff0000',
                        cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', padding: '0', lineHeight: 1,
                        transition: 'transform 0.1s'
                      }} 
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      title="Remove from tracking">✕</button>
                    </div>
                  </div>

                  {/* ── Instruments ── */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                    <MiniArcGauge value={flight.gs ?? 0} max={600} label="SPD" unit="kts" color="#dc143c" />
                    <MiniCompass heading={flight.track ?? 0} />
                    <MiniArcGauge value={altFt} max={45000} label="ALT" unit="ft" color="#8B0A14" />
                    <VertRateBar fpm={flight.vert_rate ?? 0} />
                  </div>

                  {/* ── Footer telemetry ── */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    borderTop: '1px solid rgba(100,10,15,0.4)', paddingTop: '4px', marginTop: '3px'
                  }}>
                    {[
                      { label: 'GEO ALT', value: flight.alt_geom != null ? `${Math.round(flight.alt_geom).toLocaleString()}` : '—' },
                      { label: 'BARO ALT', value: flight.alt_baro != null ? `${Math.round(flight.alt_baro).toLocaleString()}` : '—' },
                      { label: 'HEX', value: (flight.hex ?? '—').toUpperCase() },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.48rem', fontWeight: 700, color: '#ffaaaa', fontFamily: 'monospace' }}>{value}</div>
                        <div style={{ fontSize: '0.36rem', color: 'rgba(200,80,90,0.45)', letterSpacing: '0.07em' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default FlightTrackingGrid;
