import React from 'react';

interface EventIconProps {
  status: string;
  size?: number;
}

const EventIcon: React.FC<EventIconProps> = ({ status, size = 24 }) => {
  const s = status.toUpperCase();

  const getIcon = () => {
    switch (s) {
      case 'CRASH':
        return (
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* Shattered downward impact */}
            <path d="M12 2v10m0 0l-4-4m4 4l4-4" />
            <path d="M4 18h4m8 0h4m-10 4h6" />
            <path d="M12 12l2 4 3-1" />
          </g>
        );
      case 'ACCIDENT':
        return (
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* Warning triangle with impact */}
            <path d="M12 2L2 20h20L12 2z" />
            <path d="M12 8v4" />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
          </g>
        );
      case 'MONITORING':
        return (
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* Pulse wave / Radar */}
            <path d="M2 12h4l3-6 6 12 3-6h4" />
          </g>
        );
      case 'NEWS':
      default:
        return (
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* Signal waves / Broadcast */}
            <path d="M12 20v-8" />
            <path d="M8 12a4 4 0 0 1 8 0" />
            <path d="M4 8a8 8 0 0 1 16 0" />
          </g>
        );
    }
  };

  return (
    <div 
      style={{ 
        width: size, 
        height: size, 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.85
      }}
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%">
        {getIcon()}
      </svg>
    </div>
  );
};

export default EventIcon;
