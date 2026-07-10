import React from 'react';

/**
 * Label + horizontal bar + numeric value (Data Hub overview charts).
 */
export default function HorizontalBarList({
  items = [],
  labelKey = 'label',
  valueKey = 'value',
  colorKey = 'color',
  className = '',
}) {
  const rows = (items || []).filter((d) => Number(d[valueKey]) > 0);
  if (!rows.length) return null;

  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);

  return (
    <div className={`space-y-2.5 ${className}`}>
      {rows.map((row) => {
        const label = row[labelKey] || '—';
        const value = Number(row[valueKey]) || 0;
        const fill = row[colorKey] || 'var(--color-action-primary)';
        return (
          <div key={label}>
            <div className="flex justify-between items-baseline gap-2 text-[10px] font-bold mb-1">
              <span className="truncate uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
              <span className="shrink-0 tabular-nums text-[var(--color-text-primary)]">{value.toLocaleString()}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--color-bg-border)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(value / max) * 100}%`, background: fill }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
