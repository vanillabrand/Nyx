import React from 'react';
import { Sun, Cloud, CloudRain, CloudLightning, CloudSnow, Wind, CloudFog, CloudSun } from 'lucide-react';

interface METARIconProps {
  condition: string;
  size?: number;
  labelSize?: string;
  showLabel?: boolean;
}

export const METARIcon: React.FC<METARIconProps> = ({ 
  condition = 'CAVOK', 
  size = 32, 
  labelSize = '0.6rem',
  showLabel = true 
}) => {
  const getIcon = () => {
    const c = condition.toUpperCase();
    if (c.includes('TS')) return <CloudLightning size={size} strokeWidth={1} />;
    if (c.includes('RA') || c.includes('DZ')) return <CloudRain size={size} strokeWidth={1} />;
    if (c.includes('SN')) return <CloudSnow size={size} strokeWidth={1} />;
    if (c.includes('FG') || c.includes('BR')) return <CloudFog size={size} strokeWidth={1} />;
    if (c.includes('FG')) return <Wind size={size} strokeWidth={1} />;
    if (c.includes('BKN') || c.includes('OVC')) return <Cloud size={size} strokeWidth={1} />;
    if (c.includes('SCT') || c.includes('FEW')) return <CloudSun size={size} strokeWidth={1} />;
    return <Sun size={size} strokeWidth={1} />;
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      gap: '4px'
    }}>
      <div style={{ color: 'var(--theme-color)', opacity: 0.8 }}>
        {getIcon()}
      </div>
      {showLabel && (
        <div style={{ 
          fontSize: labelSize, 
          fontWeight: 300, 
          textTransform: 'uppercase', 
          opacity: 0.5,
          letterSpacing: '0.1em'
        }}>
          {condition}
        </div>
      )}
    </div>
  );
};
