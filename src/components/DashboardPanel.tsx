import React from 'react';
import { motion } from 'framer-motion';
import { GripHorizontal, X } from 'lucide-react';

interface DashboardPanelProps {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const DashboardPanel: React.FC<DashboardPanelProps> = ({ title, children, icon, className }) => {
  return (
    <motion.div
      drag
      dragMomentum={false}
      className={`glass-panel flex flex-col min-w-[300px] overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between p-2 border-b border-slate-800/50 bg-slate-900/60 drag-handle">
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-slate-500" />
          {icon}
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
            {title}
          </span>
        </div>
        <button className="text-slate-600 hover:text-slate-400 transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="p-4 flex-1 overflow-auto bg-slate-950/20">
        {children}
      </div>
      <div className="h-1 bg-cyan-500/10 w-full" />
    </motion.div>
  );
};
