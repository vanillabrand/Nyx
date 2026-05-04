import React, { useState } from 'react';
import type { FlightState } from '../services/ADSBTelemetryService';

export const EMERGENCY_SQUAWKS: Record<string, { label: string; severity: 'CRITICAL' | 'URGENT' | 'ALERT'; shortCode: string }> = {
  '7700': { label: 'GENERAL EMERGENCY',     severity: 'CRITICAL', shortCode: 'EMRG' },
  '7600': { label: 'RADIO FAILURE',         severity: 'URGENT',   shortCode: 'RDFL' },
  '7500': { label: 'UNLAWFUL INTERFERENCE', severity: 'CRITICAL', shortCode: 'HIJACK' },
  '7777': { label: 'MIL INTERCEPTION',      severity: 'ALERT',    shortCode: 'MILAIR' },
};

// Inline SVG icon matching the CatgeoryIcon pattern from ManifestStack
const EmergencyIcon = ({ severity }: { severity: string }) => {
  const color = severity === 'CRITICAL' ? 'var(--rose-red)' : severity === 'URGENT' ? '#ff8800' : '#aa44ff';
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <polygon points="12,2 22,20 2,20" stroke={color} strokeWidth="1.5" fill="none" />
      <line x1="12" y1="8" x2="12" y2="14" stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="17" r="1" fill={color} />
    </svg>
  );
};

// Aircraft silhouette matching AirlineLogo triangle pattern
const EmergencyAircraftIcon = ({ severity }: { severity: string }) => {
  const color = severity === 'CRITICAL' ? 'var(--rose-red)' : severity === 'URGENT' ? '#ff8800' : '#aa44ff';
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none"
      style={{ filter: `drop-shadow(0 0 10px ${color})` }}>
      <polygon points="32,6 44,52 32,44 20,52" stroke={color} strokeWidth="1.5" fill="none" />
      <line x1="12" y1="30" x2="52" y2="30" stroke={color} strokeWidth="1" />
    </svg>
  );
};

interface EmergencyCardProps {
  flight: FlightState;
  onDismiss: () => void;
}

const EmergencyCard: React.FC<EmergencyCardProps> = ({ flight, onDismiss }) => {
  const info = EMERGENCY_SQUAWKS[flight.squawk ?? ''] ?? { label: 'EMERGENCY', severity: 'ALERT', shortCode: 'EMRG' };
  const altFt = Math.max(flight.alt_baro ?? flight.alt_geom ?? 0, 0);
  const themeClass = info.severity === 'CRITICAL' ? 'theme-crash'
    : info.severity === 'URGENT' ? 'theme-accident'
    : 'theme-news';

  const acCode = (flight.flight || flight.hex || '—').trim();

  return (
    // Outer wrapper: same dimensions as left-panel collapsed cards (192×210)
    <div style={{ width: '192px', height: '210px', position: 'relative' }}>
      {/* Inner card: full 320×350, scaled to 60% matching left panel cards */}
      <div
        className={`manifest-card ${themeClass}`}
        style={{
          width: '320px',
          height: '350px',
          transform: 'scale(0.60)',
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0, left: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top Highlight Badge — identical to manifest cards */}
        <div className="reflective-shine">
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0 0 L100 0 L100 100 Z" fill="currentColor" opacity="0.15" />
          </svg>
        </div>

        {/* Dismiss button — top left absolute */}
        <button
          onClick={onDismiss}
          style={{
            position: 'absolute', top: '10px', left: '10px', zIndex: 10,
            background: 'none', border: 'none', color: '#ff0000',
            cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', padding: '2px', lineHeight: 1,
            transition: 'transform 0.1s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title="Acknowledge"
        >✕</button>

        {/* Clinical Grid Layout — same as ManifestStack */}
        <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', textTransform: 'uppercase' }}>

          {/* Row 1: Category icon + Status */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '24px'
          }}>
            {/* Left: Emergency icon + squawk label */}
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{ opacity: 0.9 }}>
                  <EmergencyIcon severity={info.severity} />
                </div>
                <div style={{
                  fontSize: '0.5rem', fontWeight: 900, letterSpacing: '0.1em',
                  color: 'white', opacity: 0.5, textAlign: 'center'
                }}>
                  {info.shortCode}
                </div>
              </div>
            </div>
            {/* Right: Severity + squawk code — mirrors lastUpdated/date */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.55rem', opacity: 0.4, textTransform: 'uppercase' }}>{info.severity}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--rose-red)' }}>
                SQK {flight.squawk}
              </div>
            </div>
          </div>

          {/* Row 2: Central Identity — mirrors operator logo + callsign */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', marginBottom: '24px'
          }}>
            {/* Aircraft icon (mirrors AirlineLogo) */}
            <div style={{ marginBottom: '16px' }}>
              <EmergencyAircraftIcon severity={info.severity} />
            </div>
            {/* Callsign — mirrors operator_codes large text */}
            <div className="header-text" style={{
              fontSize: '2.4rem', fontWeight: 900, lineHeight: 1,
              letterSpacing: '0.05em', textAlign: 'center', width: '100%', color: 'white'
            }}>
              {acCode}
            </div>
            {/* Registration — mirrors operator name */}
            <div style={{
              fontSize: '0.75rem', opacity: 0.6, marginTop: '4px', letterSpacing: '0.1em',
              textAlign: 'center', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {flight.r ?? '—'}
            </div>
            {/* Aircraft type — mirrors aircraft_type */}
            <div style={{
              fontSize: '0.75rem', opacity: 0.5, marginTop: '12px',
              letterSpacing: '0.2em', textAlign: 'center', fontWeight: 600
            }}>
              {flight.t ?? 'UNKNOWN'}
            </div>
          </div>

          {/* Row 3: Telemetry Path — mirrors Mission Flight Path */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
            <div style={{ fontSize: '0.45rem', opacity: 0.4, marginBottom: '2px', letterSpacing: '0.1em' }}>
              TELEMETRY FEED
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {[
                altFt > 0 ? `${Math.round(altFt / 100) * 100}FT` : 'ALT—',
                flight.gs != null ? `${Math.round(flight.gs)}KTS` : 'SPD—',
                flight.track != null ? `${Math.round(flight.track)}°` : 'HDG—',
              ].map((val, idx, arr) => (
                <React.Fragment key={idx}>
                  <span style={{
                    fontSize: '1.1rem', fontWeight: 900,
                    color: 'var(--rose-red)', letterSpacing: '0.05em'
                  }}>
                    {val}
                  </span>
                  {idx < arr.length - 1 && (
                    <span style={{ opacity: 0.2, fontSize: '0.7rem' }}>▶</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface EmergencyAlertBannerProps {
  flights: FlightState[];
}

const EmergencyAlertBanner: React.FC<EmergencyAlertBannerProps> = ({ flights }) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = flights.filter(f => !dismissed.has(f.hex));
  if (visible.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '76px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 60,
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      pointerEvents: 'all',
    }}>
      {/* Panel header — matches the clinical terminal aesthetic */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 0',
        borderBottom: '1px solid rgba(207,20,43,0.3)',
      }}>
        <div style={{
          fontSize: '0.5rem', fontWeight: 900, letterSpacing: '0.2em',
          color: 'var(--rose-red)', textTransform: 'uppercase',
          animation: 'emergencyBlink 0.9s step-end infinite',
        }}>
          ● EMERGENCY CONTACTS
        </div>
        <div style={{
          fontSize: '0.48rem', color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.12em', fontFamily: 'monospace'
        }}>
          {visible.length} ACTIVE
        </div>
      </div>

      {/* Scrollable 3-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 192px)',
        gap: '5px',
        maxHeight: '440px',
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--rose-red) transparent',
      }}>
        {visible.map(flight => (
          <EmergencyCard
            key={flight.hex}
            flight={flight}
            onDismiss={() => setDismissed(prev => new Set([...prev, flight.hex]))}
          />
        ))}
      </div>
    </div>
  );
};

export default EmergencyAlertBanner;
