import React from 'react';
import { motion } from 'framer-motion';

const NexusLoader = ({ message = 'Loading...', size = 'default' }) => {
  const sizes = {
    small: { spinner: 'w-6 h-6 border-2', text: 'text-[8px]', gap: 'gap-2', height: 'h-[30vh]' },
    default: { spinner: 'w-10 h-10 border-[3px]', text: 'text-[10px]', gap: 'gap-4', height: 'h-[60vh]' },
    large: { spinner: 'w-14 h-14 border-4', text: 'text-xs', gap: 'gap-5', height: 'h-[70vh]' },
  };
  const s = sizes[size] || sizes.default;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex flex-col items-center justify-center ${s.height} ${s.gap}`}
    >
      <div className={`${s.spinner} border-blue-500/20 border-t-blue-500 rounded-full animate-spin`} />
      <p className={`${s.text} font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]`}>{message}</p>
    </motion.div>
  );
};

export default NexusLoader;
