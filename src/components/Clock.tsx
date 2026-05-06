import React, { useState, useEffect } from 'react';

interface ClockProps {
  type?: 'date' | 'time' | 'both';
}

const Clock: React.FC<ClockProps> = ({ type = 'both' }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  if (type === 'date') {
    return (
      <div className="header-text" style={{ fontSize: '1.2rem', color: 'var(--rose-red)', letterSpacing: '0.05em', whiteSpace: 'nowrap', marginTop: '4px' }}>
        {dateStr}
      </div>
    );
  }

  if (type === 'time') {
    return (
      <div className="header-text" style={{ fontSize: '1.25rem', color: 'var(--rose-red)', letterSpacing: '0.05em', fontWeight: 900, whiteSpace: 'nowrap' }}>
        {timeStr}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginTop: '4px',
      paddingBottom: '8px',
      borderBottom: '1px solid rgba(207, 20, 43, 0.3)',
      whiteSpace: 'nowrap'
    }}>
      <div className="header-text" style={{ fontSize: '1.2rem', color: 'var(--rose-red)', letterSpacing: '0.05em' }}>
        {dateStr}
      </div>
      <div className="header-text" style={{ fontSize: '1.25rem', color: 'var(--rose-red)', letterSpacing: '0.05em', fontWeight: 900 }}>
        {timeStr}
      </div>
    </div>
  );
};

export default React.memo(Clock);
