import React from 'react';
import EventIcon from './EventIcon';

const EventLegend: React.FC = () => {
  const categories = [
    { label: 'FIRE', status: 'CRASH', color: '#ff4d4d' },
    { label: 'SMOKE', status: 'ACCIDENT', color: '#ffd700' },
    { label: 'ENGINE', status: 'ACCIDENT', color: '#ff8c00' },
    { label: 'MEDICAL', status: 'NEWS', color: '#00bfff' },
  ];

  return (
    <div style={{ 
      display: 'flex', 
      gap: '24px', 
      marginBottom: '16px',
      padding: '8px 0',
    }}>
      {categories.map((cat) => (
        <div key={cat.label} style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '6px' 
        }}>
          <div style={{ color: cat.color, opacity: 0.9 }}>
            <EventIcon status={cat.status} size={24} />
          </div>
          <div style={{ 
            fontSize: '0.5rem', 
            fontWeight: 900, 
            letterSpacing: '0.1em', 
            color: 'white',
            opacity: 0.5
          }}>
            {cat.label}
          </div>
        </div>
      ))}
    </div>
  );
};

export default React.memo(EventLegend);
