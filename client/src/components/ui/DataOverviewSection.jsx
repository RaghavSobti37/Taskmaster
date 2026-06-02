import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Database } from 'lucide-react';
import { StatCard } from './primitives';
import DataMiniChart from './DataMiniChart';
import { useIsMobile } from '../../hooks/useBreakpoint';

/**
 * @param {object} props
 * @param {Array} props.stats - { id, label, value, icon, variant, info, subValue, onClick, active, className }
 * @param {Array} props.charts - { id, title, type: 'bar'|'donut', data: [{ label, value }] }
 * @param {boolean} props.mobileCollapsed - collapse charts on mobile (default true)
 * @param {number} props.mobileMaxStats - max stats visible before expand (default 2)
 */
export default function DataOverviewSection({
  stats = [],
  charts = [],
  className = '',
  mobileCollapsed = true,
  mobileMaxStats = 2,
}) {
  const isMobile = useIsMobile();
  const [insightsOpen, setInsightsOpen] = useState(false);

  const hasStats = stats.length > 0;
  const hasCharts = charts.length > 0;
  if (!hasStats && !hasCharts) return null;

  const showCollapsedMobile = isMobile && mobileCollapsed;
  const visibleStats = showCollapsedMobile && !insightsOpen ? stats.slice(0, mobileMaxStats) : stats;
  const hiddenStatsCount = showCollapsedMobile && !insightsOpen ? Math.max(0, stats.length - mobileMaxStats) : 0;
  const showCharts = hasCharts && (!showCollapsedMobile || insightsOpen);

  return (
    <section className={`space-y-3 mb-8 ${className}`} aria-label="Data overview">
      {hasStats && (
        <div className={`grid gap-3 ${isMobile && insightsOpen ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'}`}>
          {visibleStats.map((s) => {
            const Icon = s.icon || Database;
            return (
              <StatCard
                key={s.id || s.label}
                label={s.label}
                value={s.value}
                icon={Icon}
                variant={s.variant || 'info'}
                info={s.info}
                subValue={s.subValue}
                onClick={s.onClick}
                active={s.active}
                delta={s.delta}
                className={`h-full ${s.className || ''}`}
              />
            );
          })}
        </div>
      )}
      {showCollapsedMobile && (hiddenStatsCount > 0 || hasCharts) && (
        <button
          type="button"
          onClick={() => setInsightsOpen((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-2.5 min-h-[44px] rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[11px] font-black uppercase tracking-widest text-[var(--color-action-primary)]"
        >
          {insightsOpen ? (
            <>
              Hide insights <ChevronUp size={14} />
            </>
          ) : (
            <>
              View insights {hiddenStatsCount > 0 && `(+${hiddenStatsCount} stats)`} <ChevronDown size={14} />
            </>
          )}
        </button>
      )}
      {showCharts && (
        <div
          className={`grid gap-3 ${
            charts.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {charts.map((c) => (
            <DataMiniChart
              key={c.id || c.title}
              title={c.title}
              type={c.type || 'bar'}
              data={c.data}
              height={c.height}
            />
          ))}
        </div>
      )}
    </section>
  );
}
