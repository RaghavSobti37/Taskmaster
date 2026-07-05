import React from 'react';

/**
 * KPI grid for project analytics — supports numeric + text values without digit animation.
 */
export default function ProjectAnalyticsKpiGrid({ items = [], columns = 4 }) {
  if (!items.length) return null;

  const colClass =
    columns === 5
      ? 'sm:grid-cols-2 lg:grid-cols-5'
      : columns === 3
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : 'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid grid-cols-1 gap-3 ${colClass}`}>
      {items.map((item) => {
        const Icon = item.icon;
        const isTextValue = item.textValue || (typeof item.value === 'string' && !/^[\d.,+\-₹$%]+$/.test(item.value.trim()));
        return (
          <div
            key={item.id}
            className="rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] p-4 flex flex-col gap-2 min-h-[96px]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {Icon && (
                  <Icon size={14} className="text-[var(--color-action-primary)] shrink-0" aria-hidden />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] leading-snug">
                  {item.label}
                </span>
              </div>
              {item.badge && (
                <span className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] max-w-[45%] truncate">
                  {item.badge}
                </span>
              )}
            </div>
            <div className="mt-auto">
              {isTextValue ? (
                <p className={`font-semibold leading-tight ${item.compact ? 'text-sm' : 'text-base'} text-[var(--color-text-primary)]`}>
                  {item.value}
                </p>
              ) : (
                <p className="text-2xl font-semibold tabular-nums leading-none text-[var(--color-text-primary)]">
                  {item.value}
                </p>
              )}
              {item.hint && (
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1 leading-snug">{item.hint}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
