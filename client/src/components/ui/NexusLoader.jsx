import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NexusLoader = ({ label = "Loading...", sublabel = "Setting things up", fullScreen = true }) => {
  const containerClasses = fullScreen 
    ? "fixed inset-0 bg-[var(--color-bg-workspace)] z-[9999] flex flex-col items-center justify-center backdrop-blur-md"
    : "w-full h-full min-h-[300px] flex flex-col items-center justify-center p-8 bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)]";

  return (
    <div className={containerClasses}>
      <div className="relative flex items-center justify-center">
        {/* Outer Glow */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"
        />

        {/* Floating Rings */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1],
            }}
            transition={{ 
              rotate: { duration: 3 + i, repeat: Infinity, ease: "linear" },
              scale: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }
            }}
            className={`absolute border border-blue-500/30 rounded-full`}
            style={{ 
              width: 80 + i * 30, 
              height: 80 + i * 30,
              borderWidth: 1,
              borderStyle: i % 2 === 0 ? 'solid' : 'dashed'
            }}
          />
        ))}

        {/* Central Core */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 180, 270, 360]
          }}
          transition={{ 
            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 4, repeat: Infinity, ease: "linear" }
          }}
          className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl shadow-blue-500/40 flex items-center justify-center z-10"
        >
          <div className="w-8 h-8 border-2 border-white/50 rounded-lg flex items-center justify-center">
             <div className="w-3 h-3 bg-white rounded-sm animate-pulse" />
          </div>
        </motion.div>
      </div>

      {/* Text Info */}
      <div className="mt-16 text-center space-y-3">
        <motion.h2 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-black tracking-tight text-[var(--color-text-primary)] uppercase italic"
        >
          {label}
        </motion.h2>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-center gap-2"
        >
          <p className="text-[var(--color-text-muted)] text-[10px] font-black uppercase tracking-[0.3em] ml-1">
            {sublabel}
          </p>
          <div className="w-48 h-1 bg-[var(--color-bg-border)] rounded-full overflow-hidden">
            <motion.div 
              animate={{ 
                x: [-200, 200]
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="w-full h-full bg-gradient-to-r from-transparent via-blue-500 to-transparent"
            />
          </div>
        </motion.div>
      </div>

      {/* Decorative Accents */}
      <div className="absolute top-10 right-10 flex gap-4 opacity-10">
        <div className="w-1 h-20 bg-blue-500 rounded-full" />
        <div className="w-1 h-12 bg-blue-500 rounded-full mt-4" />
      </div>
      <div className="absolute bottom-10 left-10 flex gap-4 opacity-10">
        <div className="w-1 h-12 bg-blue-500 rounded-full mb-4" />
        <div className="w-1 h-20 bg-blue-500 rounded-full" />
      </div>
    </div>
  );
};

export default NexusLoader;
