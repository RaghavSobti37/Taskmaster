import React from 'react';
import { motion } from 'framer-motion';

const PageLoader = () => {
  return (
    <div className="fixed inset-0 bg-[var(--color-bg-workspace)] flex flex-col items-center justify-center z-[9999]">
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: [0, 180, 360]
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="w-12 h-12 bg-[var(--color-action-primary)] rounded-2xl shadow-xl shadow-blue-500/20 mb-6"
      />
      <h2 className="text-xl font-bold tracking-tight animate-pulse">Initializing CoreKnot...</h2>
      <p className="text-[var(--color-text-muted)] text-sm mt-2">Connecting to High-Performance Backend</p>
    </div>
  );
};

export default PageLoader;
