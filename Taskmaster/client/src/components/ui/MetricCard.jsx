import React from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import TransitionCard from './TransitionCard';
import NumberPopIn from './NumberPopIn';

const ACCENT = {
  info: 'border-l-[var(--color-pastel-blue-text)]',
  mint: 'border-l-[var(--color-pastel-mint-text)]',
  rose: 'border-l-[var(--color-pastel-rose-text)]',
  apricot: 'border-l-[var(--color-pastel-apricot-text)]',
  slate: 'border-l-[var(--color-pastel-slate-text)]',
};

const formatDelta = (delta) => {
  if (delta == null || Number.isNaN(Number(delta))) return null;
  const n = Number(delta);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString()}`;
};

const formatDeltaPercent = (deltaPercent) => {
  if (deltaPercent == null || Number.isNaN(Number(deltaPercent))) return null;
  const n = Number(deltaPercent);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n}%`;
};

const TrendIcon = ({ trend }) => {
  if (trend === 'up') return <TrendingUp size={12} strokeWidth={2.5} aria-hidden />;
  if (trend === 'down') return <TrendingDown size={12} strokeWidth={2.5} aria-hidden />;
  return <Minus size={12} strokeWidth={2.5} aria-hidden />;
};

export default function MetricCard({
  label,
  value,
  delta,
  deltaPercent,
  trend = 'flat',
  periodLabel,
  variant = 'slate',
  sparkline,
  className = '',
  onClick,
  fill = false,
}) {
  const deltaText = formatDelta(delta);
  const pctText = formatDeltaPercent(deltaPercent);
  const isDown = trend === 'down';
  const deltaClass = isDown ? 'tm-delta-negative' : trend === 'up' ? 'tm-delta-positive' : 'text-[var(--color-text-muted)]';

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="tm-widget-label leading-none truncate">{label}</span>
        {periodLabel && (
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] shrink-0">
            {periodLabel}
          </span>
        )}
      </div>

      <div className={`flex items-end justify-between gap-2 ${fill ? 'mt-auto min-h-[2.5rem]' : ''}`}>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="tm-data-primary tabular-nums text-2xl font-semibold leading-none">
            <NumberPopIn value={typeof value === 'number' ? value.toLocaleString() : value} />
          </span>
          {(deltaText || pctText) && (
            <div className={`flex items-center gap-1.5 text-[10px] font-bold tabular-nums ${deltaClass}`}>
              <TrendIcon trend={trend} />
              {deltaText && <span>{deltaText}</span>}
              {pctText && <span className="opacity-80">({pctText})</span>}
            </div>
          )}
        </div>
        {sparkline && (
          <div className="flex-shrink-0 flex items-center justify-end">{sparkline}</div>
        )}
      </div>
    </>
  );

  const shellClass = `p-3 flex flex-col gap-2 rounded-[var(--radius-atomic)] border-l-2 bg-[var(--color-bg-surface)] ${ACCENT[variant] || ACCENT.slate} ${onClick ? 'cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors' : ''} ${fill ? 'h-full' : ''} ${className}`;

  if (onClick) {
    return (
      <TransitionCard
        onClick={onClick}
        className={fill ? 'h-full' : ''}
        innerClassName={shellClass}
        maxDeg={8}
      >
        {body}
      </TransitionCard>
    );
  }

  return (
    <div className={shellClass}>
      {body}
    </div>
  );
}
