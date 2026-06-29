import React from 'react';
import { Database } from 'lucide-react';
import { Skeleton } from './primitives';
import MetricBlock from './MetricBlock';

export default function MetricPanelGroup({ panels = [], className = '', columns = 3 }) {
  if (!panels.length) return null;

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[columns] || 'grid-cols-1 md:grid-cols-3';

  return (
    <div className={`grid ${gridCols} gap-3 ${className}`}>
      {panels.map((panel) => {
        const Icon = panel.icon || Database;
        const colSpan = panel.colSpan
          ? { 2: 'md:col-span-2', 3: 'md:col-span-3' }[panel.colSpan] || ''
          : '';

        return (
          <section
            key={panel.id || panel.title}
            className={`py-4 border-t border-[var(--color-bg-border)] space-y-4 ${colSpan} ${panel.className || ''}`}
          >
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--color-bg-border)]">
              <Icon size={14} className="text-[var(--color-text-muted)] shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                {panel.title}
              </span>
              {panel.headerAction}
            </div>
            {panel.loading ? (
              panel.loadingSkeleton || (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[...Array(panel.skeletonCount || 3)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              )
            ) : panel.children ? (
              panel.children
            ) : (
              <div
                className={
                  panel.metricsLayout === 'stack'
                    ? 'space-y-2'
                    : `grid gap-3 ${panel.metricsCols === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`
                }
              >
                {(panel.metrics || []).map((m) => (
                  <MetricBlock
                    key={m.id || m.label}
                    label={m.label}
                    value={m.value}
                    sub={m.sub}
                    tone={m.tone}
                    title={m.title}
                    size={m.size}
                    onClick={m.onClick}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
