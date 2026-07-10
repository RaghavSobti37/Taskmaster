import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { formatDisplayDateTimeSeconds } from '../../utils/dateDisplay';

function formatTimestamp(value) {
  return formatDisplayDateTimeSeconds(value);
}

export default function DataHubTemporalColumn({ value, label = 'Updated' }) {
  const [hovered, setHovered] = useState(false);
  const formatted = formatTimestamp(value);

  return (
    <motion.div
      className="inline-flex items-center gap-1.5 min-w-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{ width: hovered ? 'auto' : 40 }}
      transition={{ duration: 0.15 }}
    >
      <Clock size={12} className="shrink-0 text-[var(--color-text-muted)]" />
      <motion.span
        className="text-[9px] text-[var(--color-text-muted)] font-mono whitespace-nowrap overflow-hidden"
        initial={false}
        animate={{ opacity: hovered ? 1 : 0, maxWidth: hovered ? 200 : 0 }}
        transition={{ duration: 0.15 }}
        title={formatted}
      >
        {formatted}
      </motion.span>
      {!hovered && value && (
        <span className="sr-only">{label}: {formatted}</span>
      )}
    </motion.div>
  );
}
