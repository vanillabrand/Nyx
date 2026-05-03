import React, { useState, useEffect } from 'react';

const Clock: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginTop: '4px',
      whiteSpace: 'nowrap'
    }}>
      <div className="header-text" style={{ fontSize: '1.2rem', color: 'var(--rose-red)', letterSpacing: '0.05em', paddingRight: '15px' }}>
        {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
      </div>
      <div style={{ width: '1px', height: '1.5rem', background: 'var(--rose-red)', opacity: 0.5 }}></div>
      <div className="header-text" style={{ fontSize: '1.25rem', color: 'var(--rose-red)', letterSpacing: '0.05em', fontWeight: 900 }}>
        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
      </div>
    </div>
  );
};

export default React.memo(Clock);
