import React from 'react';
import { 
  Flame, 
  Wind, 
  Zap, 
  ShieldAlert, 
  CircleDot, 
  PlaneLanding, 
  Eye, 
  Wrench, 
  Activity,
  Droplets,
  AlertTriangle,
  Waves,
  Stethoscope,
  Cloudy,
  Cpu
} from 'lucide-react';

interface CategoryIconProps {
  category: string;
  size?: number;
  color?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ 
  category, 
  size = 14, 
  color = 'var(--rose-red)' 
}) => {
  const c = category.toUpperCase();

  const getIcon = () => {
    // Fire & Smoke
    if (c.includes('FIRE')) return <Flame size={size} />;
    if (c.includes('SMOKE') || c.includes('FUMES')) return <Wind size={size} />;
    if (c.includes('ODOUR')) return <Waves size={size} />;

    // Systems & Technical
    if (c.includes('ENGINE')) return <Zap size={size} />;
    if (c.includes('HYDRAULIC')) return <Droplets size={size} />;
    if (c.includes('TECHNICAL') || c.includes('AVIONICS') || c.includes('ELECTRICAL')) return <Cpu size={size} />;
    if (c.includes('WRENCH')) return <Wrench size={size} />;
    
    // Safety & Human
    if (c.includes('PAX') || c.includes('SAFETY')) return <ShieldAlert size={size} />;
    if (c.includes('MEDICAL')) return <Stethoscope size={size} />;
    
    // Mechanical
    if (c.includes('TYRE') || c.includes('GEAR') || c.includes('BRAKE')) return <CircleDot size={size} />;
    if (c.includes('LANDING')) return <PlaneLanding size={size} />;
    if (c.includes('BIRD')) return <AlertTriangle size={size} />;

    // General Status
    if (c.includes('MONITORING')) return <Eye size={size} />;
    if (c.includes('WEATHER')) return <Cloudy size={size} />;
    
    // Default
    return <Activity size={size} />;
  };

  return (
    <div style={{ color, display: 'flex', alignItems: 'center' }}>
      {getIcon()}
    </div>
  );
};
