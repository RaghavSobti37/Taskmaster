import React from 'react';

const GRID_STROKE = 'var(--color-bg-border)';

export const CHART_MUTED = {
  grid: { stroke: GRID_STROKE, strokeDasharray: '3 3', opacity: 0.35 },
  axis: { fontSize: 10, fill: 'var(--color-text-muted)' },
  tooltip: {
    backgroundColor: 'var(--color-bg-surface)',
    border: '1px solid var(--color-bg-border)',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
  },
};

/**
 * Flat chart container — no card border/shadow; data line carries color.
 */
export default function ChartSurface({ title, info, actions, children, className = '', height }) {
  const chartAreaStyle = height ? { height, minHeight: height } : undefined;

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-3 shrink-0">
          {title && <p className="tm-widget-label mb-0">{title}</p>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {info}
      <div
        className={`w-full ${height ? 'shrink-0' : 'flex-1 min-h-0'}`}
        style={chartAreaStyle}
      >
        {children}
      </div>
    </div>
  );
}
