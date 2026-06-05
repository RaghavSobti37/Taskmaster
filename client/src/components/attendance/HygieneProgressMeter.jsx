import React from 'react';
import { UNLOGGED_THRESHOLD_MINUTES } from '../../utils/attendanceMetrics';
import { formatMinuteGap } from '../../utils/timeSpent';

const R = 18;
const C = 2 * Math.PI * R;

export default function HygieneProgressMeter({
  unloggedMinutes = 0,
  threshold = UNLOGGED_THRESHOLD_MINUTES,
  className = '',
}) {
  const clamped = Math.max(0, unloggedMinutes);
  const progress = Math.max(0, Math.min(1, 1 - clamped / threshold));
  const offset = C * (1 - progress);
  const needsAttention = clamped >= threshold;
  const strokeColor = needsAttention
    ? 'var(--color-pastel-rose-text)'
    : 'var(--color-action-primary)';

  return (
    <div className={`flex items-center gap-3 ${className}`} title="Daily log hygiene">
      <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 -rotate-90" aria-hidden>
        <circle
          cx="22"
          cy="22"
          r={R}
          fill="none"
          stroke="var(--color-bg-border)"
          strokeWidth="4"
        />
        <circle
          cx="22"
          cy="22"
          r={R}
          fill="none"
          stroke={strokeColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
          Log hygiene
        </p>
        <p className={`text-sm font-bold tabular-nums ${needsAttention ? 'text-[var(--color-pastel-rose-text)]' : 'text-[var(--color-text-primary)]'}`}>
          {needsAttention ? `${formatMinuteGap(clamped)} to log` : 'On track'}
        </p>
      </div>
    </div>
  );
}
