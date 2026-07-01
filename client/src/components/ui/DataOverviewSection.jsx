import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Database } from 'lucide-react';
import { Skeleton, StatCard } from './primitives';
import { useIsMobile } from '../../hooks/useBreakpoint';

const DataMiniChart = lazy(() => import('./DataMiniChart'));

const ChartFallback = () => (
  <div className="rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] p-3 bg-[var(--color-bg-surface)] min-h-[120px] flex items-center justify-center">
    <Skeleton width="100%" height="80px" />
  </div>
);

/**
 * @param {object} props
 * @param {Array} props.stats - { id, label, value, icon, variant, info, subValue, highlights, onClick, active, className }
 * @param {Array} props.charts - { id, title, type: 'bar'|'donut', data: [{ label, value }] }
 * @param {boolean} props.mobileCollapsed - collapse charts on mobile (default true)
 * @param {number} props.mobileMaxStats - max stats visible before expand (default 2)
 * @param {boolean} props.eagerCharts - render charts immediately (skip idle/intersection defer)
 */
export default function DataOverviewSection({
  stats = [],
  charts = [],
  className = '',
  mobileCollapsed = true,
  mobileMaxStats = 2,
  eagerCharts = false,
}) {
  const isMobile = useIsMobile();
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [sectionVisible, setSectionVisible] = useState(false);
  const sectionRef = useRef(null);

  const hasStats = stats.length > 0;
  const hasCharts = charts.length > 0;

  useEffect(() => {
    if (eagerCharts && hasCharts) {
      setSectionVisible(true);
      setChartsReady(true);
      return undefined;
    }
    const el = sectionRef.current;
    if (!el || !hasCharts) {
      setSectionVisible(false);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setSectionVisible(true);
      },
      { rootMargin: '120px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasCharts, eagerCharts]);

  useEffect(() => {
    if (eagerCharts) return undefined;
    if (!hasCharts || (!sectionVisible && !insightsOpen)) {
      setChartsReady(false);
      return undefined;
    }
    const enable = () => setChartsReady(true);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(enable, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(enable, 500);
    return () => window.clearTimeout(timer);
  }, [hasCharts, sectionVisible, insightsOpen, eagerCharts]);

  if (!hasStats && !hasCharts) return null;

  const showCollapsedMobile = isMobile && mobileCollapsed;
  const visibleStats = showCollapsedMobile && !insightsOpen ? stats.slice(0, mobileMaxStats) : stats;
  const hiddenStatsCount = showCollapsedMobile && !insightsOpen ? Math.max(0, stats.length - mobileMaxStats) : 0;
  const showCharts = hasCharts && chartsReady && (!showCollapsedMobile || insightsOpen);

  const chartGridCols =
    charts.length >= 4
      ? 'lg:grid-cols-4'
      : charts.length === 3
        ? 'lg:grid-cols-3'
        : charts.length === 2
          ? 'lg:grid-cols-2'
          : 'grid-cols-1';

  return (
    <section ref={sectionRef} className={`data-overview-section space-y-4 ${className}`} aria-label="Data overview">
      {hasStats && (
        <div
          className={`grid w-full gap-4 ${
            isMobile && insightsOpen ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'
          }`}
        >
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
                highlights={s.highlights}
                onClick={s.onClick}
                active={s.active}
                delta={s.delta}
                className={`h-full ${s.className || ''}`}
              />
            );
          })}
        </div>
      )}
      {showCharts && (
        <div className={`grid w-full grid-cols-1 gap-4 ${chartGridCols}`}>
          {charts.map((c) => (
            <div
              key={c.id || c.title}
              className="min-w-0 min-h-[168px] overflow-hidden rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)]"
            >
              <Suspense fallback={<ChartFallback />}>
                <DataMiniChart
                  title={c.title}
                  type={c.type || 'bar'}
                  data={c.data}
                  height={c.height}
                  className="h-full"
                />
              </Suspense>
            </div>
          ))}
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
    </section>
  );
}
