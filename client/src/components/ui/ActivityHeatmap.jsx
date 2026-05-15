import React from 'react';
import { motion } from 'framer-motion';

const ActivityHeatmap = ({ data = [], title = "Activity Trends" }) => {
  // Mock grid for visualization if no data provided
  const days = 7;
  const weeks = 24;
  const totalCells = days * weeks;
  
  const cells = Array.from({ length: totalCells }).map((_, i) => ({
    id: i,
    intensity: Math.floor(Math.random() * 5), // 0 to 4
  }));

  const getIntensityColor = (intensity) => {
    switch (intensity) {
      case 0: return 'bg-[var(--color-bg-workspace)]';
      case 1: return 'bg-blue-500/20';
      case 2: return 'bg-blue-500/40';
      case 3: return 'bg-blue-500/70';
      case 4: return 'bg-blue-600';
      default: return 'bg-[var(--color-bg-workspace)]';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-[0.2em]">{title}</h3>
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase">Less</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className={`w-2.5 h-2.5 rounded-[2px] ${getIntensityColor(i)} border border-[var(--color-bg-border)]/10`} />
            ))}
          </div>
          <span className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase">More</span>
        </div>
      </div>
      
      <div className="flex gap-1 overflow-x-auto custom-scrollbar-hide pb-2">
        {Array.from({ length: weeks }).map((_, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-1 shrink-0">
            {Array.from({ length: days }).map((_, dayIdx) => {
              const cell = cells[weekIdx * days + dayIdx];
              return (
                <motion.div
                  key={dayIdx}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (weekIdx * days + dayIdx) * 0.001 }}
                  whileHover={{ scale: 1.4, zIndex: 10 }}
                  className={`w-3 h-3 rounded-[3px] ${getIntensityColor(cell.intensity)} border border-[var(--color-bg-border)]/20 shadow-sm cursor-pointer transition-colors duration-300`}
                  title={`Activity level: ${cell.intensity}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      
      <div className="flex justify-between text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-widest opacity-50 px-1">
        <span>Jan</span>
        <span>Mar</span>
        <span>May</span>
        <span>Jul</span>
        <span>Sep</span>
        <span>Nov</span>
      </div>
    </div>
  );
};

export default ActivityHeatmap;
