import React from 'react';

interface AirlineLogoProps {
  operator?: string; // Made optional
  size?: number;
}

const AirlineLogo: React.FC<AirlineLogoProps> = ({ operator = '', size = 32 }) => {
  // Ultra-robust check to prevent the 'toUpperCase' crash reported by user
  const name = String(operator || '').toUpperCase();

  const getLogoPath = () => {
    if (!name) return <path fill="currentColor" d="M4 28h24c-2-8-6-20-8-24H10c2 4 6 16 8 24H4z" opacity="0.8" />;
    
    if (name.includes('PORTER')) {
      return (
        <g fill="currentColor">
          <path d="M10 5h12c4 0 6 3 6 6s-2 6-6 6H14v10h-4V5z m4 8h8c2 0 2-2 2-3s-1-3-2-3h-8v6z" />
          <path d="M5 15c-2 0-3 1-3 3s1 3 3 3h3v-6H5z" opacity="0.6" />
        </g>
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
      return (
        <path fill="currentColor" d="M2 10l6 12 6-12 6 12 6-12h-4l-4 8-4-8-4 8-4-8z" />
      );
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
      return (
        <path fill="currentColor" d="M16 2L2 28h28L16 2z m0 8l8 16H8l8-16z" />
      );
    }
    
    return (
      <path fill="currentColor" d="M4 28h24c-2-8-6-20-8-24H10c2 4 6 16 8 24H4z" opacity="0.8" />
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
