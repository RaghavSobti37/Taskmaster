import React from 'react';
import TransitionCard from './TransitionCard';

/**
 * Card row for mobile lists (Todo, Assets, etc.) — touch-friendly, card hover tilt.
 */
export default function ListCard({
  onClick,
  highlightId,
  className = '',
  style,
  primary,
  secondary,
  meta,
  actions,
  leading,
  trailing,
}) {
  return (
    <TransitionCard
      onClick={onClick}
      data-highlight-id={highlightId || undefined}
      style={style}
      maxDeg={6}
      innerClassName={`p-4 border-b border-[var(--color-bg-border)] bg-transparent cursor-pointer ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        {leading && <div className="shrink-0 flex items-center min-h-[44px]">{leading}</div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="flex-1 min-w-0">{primary}</div>
            {trailing && <div className="shrink-0 text-right">{trailing}</div>}
          </div>
          {secondary && <div className="mt-1 min-w-0">{secondary}</div>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2 min-w-0">{meta}</div>}
        </div>
      </div>
      {actions && (
        <div
          className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-[var(--color-bg-border)]"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </TransitionCard>
  );
}
