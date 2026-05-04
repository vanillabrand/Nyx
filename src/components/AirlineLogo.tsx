import React from 'react';

interface AirlineLogoProps {
  operator?: string; // Made optional
  size?: number;
}

const AirlineLogo: React.FC<AirlineLogoProps> = ({ operator = '', size = 32 }) => {
  // Ultra-robust check to prevent the 'toUpperCase' crash reported by user
  const name = String(operator || '').toUpperCase();

  const getLogoPath = () => {
    if (!name || name === 'UNKNOWN') return <path fill="currentColor" d="M4 28h24c-2-8-6-20-8-24H10c2 4 6 16 8 24H4z" opacity="0.4" />;
    
    // --- North America ---
    if (name.includes('SOUTHWEST')) {
      return (
        <path fill="currentColor" d="M16 28c-4-4-12-8-12-16a8 8 0 0 1 16 0 8 8 0 0 1 16 0c0 8-8 12-12 16L16 30z" opacity="0.9" />
      );
    }
    if (name.includes('AMERICAN')) {
      return (
        <path fill="currentColor" d="M16 4L4 28h5l2-5h10l2 5h5L16 4z m-4 15l4-10 4 10h-8z" />
      );
    }
    if (name.includes('AIR CANADA')) {
      return (
        <g fill="currentColor">
          <path d="M16 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" />
          <path d="M16 30v-8" stroke="currentColor" strokeWidth="2" />
        </g>
      );
    }
    if (name.includes('WESTJET')) {
      return <path fill="currentColor" d="M2 10l6 12 6-12 6 12 6-12h-4l-4 8-4-8-4 8-4-8z" />;
    }
    if (name.includes('UNITED')) {
      return (
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="16" cy="16" r="14" />
          <path d="M2 16h28M16 2v28M16 2c4 0 7 6 7 14s-3 14-7 14M16 2c-4 0-7 6-7 14s3 14 7 14" />
        </g>
      );
    }
    if (name.includes('DELTA')) {
      return <path fill="currentColor" d="M16 2L2 28h28L16 2z m0 8l8 16H8l8-16z" />;
    }
    if (name.includes('PORTER')) {
      return (
        <g fill="currentColor">
          <path d="M10 5h12c4 0 6 3 6 6s-2 6-6 6H14v10h-4V5z m4 8h8c2 0 2-2 2-3s-1-3-2-3h-8v6z" />
          <path d="M5 15c-2 0-3 1-3 3s1 3 3 3h3v-6H5z" opacity="0.6" />
        </g>
      );
    }
    if (name.includes('ALASKA')) {
      return <path fill="currentColor" d="M16 2c-7.7 0-14 6.3-14 14s6.3 14 14 14 14-6.3 14-14-6.3-14-14-14z m0 2c6.6 0 12 5.4 12 12s-5.4 12-12 12-12-5.4-12-12 5.4-12 12-12z m-2 4h4l3 10-2 2-5-12z" />;
    }
    if (name.includes('JETBLUE')) {
      return <rect fill="currentColor" x="4" y="4" width="24" height="24" rx="4" />;
    }

    // --- Europe ---
    if (name.includes('LUFTHANSA')) {
      return (
        <g fill="currentColor">
          <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 20c4-4 12-4 16 0l-4-8c-4-4-8 0-12 8z" />
        </g>
      );
    }
    if (name.includes('BRITISH')) {
      return <path fill="currentColor" d="M2 24c4-4 24-4 28 0v4H2v-4z M2 10c10-4 20 4 30 0v4c-10 4-20-4-30 0v-4z" opacity="0.8" />;
    }
    if (name.includes('AIR FRANCE')) {
      return <path fill="currentColor" d="M4 2L28 16 4 30V2z" />;
    }
    if (name.includes('RYANAIR')) {
      return <path d="M6 10l4 12 10-12 4 12 4-12" stroke="currentColor" strokeWidth="2" fill="none" />;
    }
    if (name.includes('EASYJET')) {
      return <text x="16" y="22" textAnchor="middle" fill="currentColor" fontSize="18" fontWeight="900" style={{ fontFamily: 'sans-serif' }}>eJ</text>;
    }
    if (name.includes('KUZU') || name.includes('TURKISH')) {
      return <path d="M16 2c-7.7 0-14 6.3-14 14s6.3 14 14 14 14-6.3 14-14-6.3-14-14-14z m8 12c-4 0-8 4-8 8s4 8 8 8" fill="none" stroke="currentColor" strokeWidth="3" />;
    }

    // --- Asia / Middle East ---
    if (name.includes('EMIRATES')) {
      return <path fill="currentColor" d="M4 4h24v4H4z m0 8h24v4H4z m0 8h24v4H4z" />;
    }
    if (name.includes('QATAR')) {
      return <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="4 2" />;
    }
    if (name.includes('SINGAPORE')) {
      return <path fill="currentColor" d="M4 16l12-12 12 12-12 12L4 16z" opacity="0.9" />;
    }
    if (name.includes('CATHAY')) {
      return <path d="M4 16c0-6.6 5.4-12 12-12s12 5.4 12 12" fill="none" stroke="currentColor" strokeWidth="3" />;
    }

    // --- South America / Other ---
    if (name.includes('AZUL')) {
      return <path fill="currentColor" d="M4 10h24v4H4z m0 8h24v4H4z" opacity="0.9" />;
    }
    if (name.includes('GOL')) {
      return (
        <g fill="currentColor">
          <circle cx="10" cy="16" r="6" />
          <circle cx="22" cy="16" r="6" />
          <path d="M14 16h4v2h-4z" />
        </g>
      );
    }
    if (name.includes('LATAM')) {
      return <path fill="currentColor" d="M4 4l12 12L28 4v24H4z" />;
    }
    
    // --- Dynamic Fallback: Letter-based Monogram ---
    // Generates a clinical, high-fidelity letter badge for unknown operators
    const letter = name.charAt(0);
    return (
      <g>
        <rect x="2" y="2" width="28" height="28" rx="4" fill="currentColor" opacity="0.15" />
        <text x="16" y="22" textAnchor="middle" fill="currentColor" fontSize="20" fontWeight="900" style={{ fontFamily: 'monospace' }}>
          {letter}
        </text>
      </g>
    );
  };

  return (
    <div 
      className="airline-badge"
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'inherit'
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 32 32">
        {getLogoPath()}
      </svg>
    </div>
  );
};

export default AirlineLogo;
