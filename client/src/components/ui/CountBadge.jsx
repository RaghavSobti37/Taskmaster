import React from 'react';

const SIZE = {
  sm: 'h-4 min-w-4 px-1 text-[8px]',
  md: 'h-5 min-w-5 px-1 text-[10px]',
};

const VARIANT = {
  rose: 'bg-rose-500 text-white',
  amber: 'bg-amber-500 text-[var(--color-bg-primary)]',
  teal: 'bg-[var(--color-brand-teal)] text-white',
  slate: 'bg-[var(--color-bg-border)] text-[var(--color-text-primary)]',
  warning: 'bg-amber-500/90 text-[var(--color-bg-primary)]',
  info: 'bg-[var(--color-pastel-blue-bg)] text-[var(--color-pastel-blue-text)] border border-[var(--color-pastel-blue-text)]/30',
  overdue: 'bg-rose-500 text-white',
};

/**
 * Numeric indicator pill with notification-badge pop (transitions.dev).
 */
export default function CountBadge({
  count,
  max = 99,
  size = 'md',
  variant = 'rose',
  className = '',
  pulse = false,
  title,
}) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  const label = n > max ? `${max}+` : String(n);
  return (
    <span className={`t-badge t-badge--inline relative inline-flex ${className}`} data-open="true" title={title}>
      <span
        className={`t-badge-dot inline-flex items-center justify-center rounded-full font-bold tabular-nums shrink-0 border-2 border-[var(--color-bg-surface)] ${SIZE[size] || SIZE.md} ${VARIANT[variant] || VARIANT.rose} ${pulse ? 'animate-pulse' : ''}`}
      >
        {label}
      </span>
    </span>
  );
}
