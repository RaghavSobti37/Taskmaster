import React from 'react';
import { motion } from 'framer-motion';

const ProgressRing = ({ 
  progress = 0, 
  size = 120, 
  strokeWidth = 8, 
  color = 'var(--color-action-primary)',
  label = '',
  sublabel = '',
  showLabel = true
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background Ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-bg-border)"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="opacity-20"
        />
        {/* Progress Ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: [0.23, 1, 0.32, 1] }}
          strokeLinecap="round"
        />
      </svg>
      
      {/* Center Labels */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.span 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-2xl font-black text-[var(--color-text-primary)] italic"
          >
            {Math.round(progress)}%
          </motion.span>
          {label && (
            <span className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-widest -mt-1">
              {label}
            </span>
          )}
        </div>
      )}
      
      {/* Decorative Outer Glow in Dark Mode */}
      <div className="absolute inset-0 rounded-full dark:shadow-[0_0_20px_-5px_var(--color-action-primary)] pointer-events-none opacity-20" />
    </div>
  );
};

export default ProgressRing;
