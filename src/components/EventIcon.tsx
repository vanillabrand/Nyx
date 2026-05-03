import React from 'react';

interface EventIconProps {
  status?: string;
  size?: number;
}

const EventIcon: React.FC<EventIconProps> = ({ status = '', size = 24 }) => {
  const s = (status || '').toUpperCase();

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
            {/* Warning triangle with alert symbol */}
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </g>
        );
      case 'NEWS':
      default:
        return (
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* Signal/Monitoring radar icon */}
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
            <path d="M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </g>
        );
    }
  };

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24"
      style={{ display: 'block' }}
    >
      {getIcon()}
    </svg>
  );
};

export default React.memo(EventIcon);
