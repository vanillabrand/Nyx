import React from 'react';
import { lookupSquawk } from '../utils/squawkLookup';

interface LiveTelemetryPopupProps {
  flight: any;
  onClose: () => void;
}

// Mini SVG Dial for Heading/Track
const HeadingDial = ({ track }: { track: number }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
    <svg width="40" height="40" viewBox="0 0 100 100" style={{ transform: `rotate(${track}deg)` }}>
      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
      <path d="M50 10 L60 30 L50 25 L40 30 Z" fill="var(--rose-red)" />
      <line x1="50" y1="25" x2="50" y2="90" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeDasharray="4 4" />
      <text x="50" y="8" fill="white" fontSize="14" textAnchor="middle" transform={`rotate(${-track} 50 50)`}>N</text>
    </svg>
    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)' }}>HDG</div>
    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{Math.round(track)}°</div>
  </div>
);

// Mini Vector Dial for Speed
const SpeedDial = ({ speed }: { speed: number }) => {
  const maxSpeed = 600;
  const percentage = Math.min(speed / maxSpeed, 1);
  const strokeDasharray = `${percentage * 125} 125`; // 125 is approx half circumference of r=40
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <svg width="40" height="40" viewBox="0 0 100 100">
        <path d="M 20 80 A 40 40 0 1 1 80 80" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" strokeLinecap="round" />
        <path d="M 20 80 A 40 40 0 1 1 80 80" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeDasharray={strokeDasharray} />
        <text x="50" y="60" fill="white" fontSize="20" fontWeight="bold" textAnchor="middle">{Math.round(speed)}</text>
      </svg>
      <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)' }}>KTS GS</div>
    </div>
  );
};

// Simple Vertical Speed Indicator
const VSpeedIndicator = ({ rate }: { rate: number }) => {
  const isClimbing = rate > 0;
  const isDescending = rate < 0;
  const absRate = Math.abs(rate);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}>
        {isClimbing && <span style={{ color: '#4ade80', fontSize: '1.2rem' }}>▲</span>}
        {isDescending && <span style={{ color: 'var(--rose-red)', fontSize: '1.2rem' }}>▼</span>}
        {rate === 0 && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '1.2rem' }}>—</span>}
      </div>
      <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)' }}>V/S</div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: isClimbing ? '#4ade80' : isDescending ? 'var(--rose-red)' : 'white' }}>
        {isClimbing ? '+' : ''}{isDescending ? '-' : ''}{absRate}
      </div>
    </div>
  );
};

export const LiveTelemetryPopup: React.FC<LiveTelemetryPopupProps> = ({ flight, onClose }) => {
  const alt = flight.alt_geom ?? flight.alt_baro ?? 0;
  const speed = flight.gs ?? flight.tas ?? flight.ias ?? 0;
  const vrate = flight.geom_rate ?? flight.baro_rate ?? 0;
  const squawkStr = lookupSquawk(flight.squawk);
  
  const isEmergency = flight.squawk === '7700' || flight.squawk === '7600' || flight.squawk === '7500';

  return (
    <div className="incident-card" style={{
      width: '320px',
      height: 'auto',
      pointerEvents: 'all',
      boxShadow: '0 10px 40px rgba(0,0,0,0.8), 0 0 20px rgba(207, 20, 43, 0.2)',
      border: isEmergency ? '1px solid var(--rose-red)' : '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(5, 5, 5, 0.95)',
      backdropFilter: 'blur(10px)',
      position: 'relative'
    }}>
      <button 
        onClick={onClose}
        style={{
          position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '1rem'
        }}
      >
        ✕
      </button>

      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px' }}>
        <div style={{ color: 'var(--rose-red)', fontSize: '0.65rem', letterSpacing: '0.2em', marginBottom: '4px' }}>
          LIVE TELEMETRY
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.05em' }}>
          {flight.flight ? flight.flight.trim() : 'UNKNOWN'}
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.5, letterSpacing: '0.1em' }}>
          HEX: {flight.hex.toUpperCase()}
        </div>
      </div>

      {/* Primary Metrics (Big) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '0 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }}>ALTITUDE</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'monospace' }}>
            {alt === 'ground' ? 'GND' : `${alt.toLocaleString()} FT`}
          </div>
        </div>
      </div>

      {/* Vector Dials Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', marginBottom: '16px' }}>
        <SpeedDial speed={speed} />
        <HeadingDial track={flight.track || 0} />
        <VSpeedIndicator rate={vrate} />
      </div>

      {/* Squawk Translator */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: isEmergency ? 'rgba(207, 20, 43, 0.1)' : 'transparent', padding: isEmergency ? '8px' : '0', borderRadius: '4px' }}>
        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }}>TRANSPONDER / SQUAWK</div>
        <div style={{ fontSize: '0.9rem', color: isEmergency ? 'var(--rose-red)' : 'white' }}>
          <span style={{ fontWeight: 700, marginRight: '8px' }}>{flight.squawk || '0000'}</span>
          <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>{squawkStr}</span>
        </div>
      </div>
      
    </div>
  );
};
