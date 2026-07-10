import React from 'react';
import { UNLOGGED_THRESHOLD_MINUTES } from '../../utils/attendanceMetrics';
import { formatMinuteGap } from '../../utils/timeSpent';

const R = 16;
const C = 2 * Math.PI * R;
const SIZE = 40;

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
  const ringBg = needsAttention
    ? 'color-mix(in srgb, var(--color-pastel-rose-text) 8%, transparent)'
    : 'color-mix(in srgb, var(--color-action-primary) 8%, transparent)';

  return (
    <div
      className={`flex items-center gap-2.5 shrink-0 ${className}`}
      title="Daily log hygiene"
      role="status"
      aria-label={needsAttention ? `${formatMinuteGap(clamped)} still to log` : 'Log hygiene on track'}
    >
      <div
        className="relative flex shrink-0 items-center justify-center rounded-full"
        style={{ width: SIZE, height: SIZE, background: ringBg }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 -rotate-90" aria-hidden>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--color-bg-border)"
            strokeWidth="3"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
      </div>
      <div className="min-w-0 text-right sm:text-left">
        <p className="tm-widget-label mb-0 leading-none">Log hygiene</p>
        <p
          className={`text-sm font-semibold tabular-nums leading-tight mt-0.5 ${
            needsAttention ? 'text-[var(--color-pastel-rose-text)]' : 'text-[var(--color-action-primary)]'
          }`}
        >
          {needsAttention ? `${formatMinuteGap(clamped)} to log` : 'On track'}
        </p>
      </div>
    </div>
  );
}
