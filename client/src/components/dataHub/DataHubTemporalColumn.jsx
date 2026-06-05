import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

function formatTimestamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
