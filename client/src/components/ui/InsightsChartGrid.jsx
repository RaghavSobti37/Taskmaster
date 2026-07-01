import React, { useMemo } from 'react';
import { Skeleton } from './primitives';
import FunnelChart, { FUNNEL_CHART_COLORS } from './FunnelChart';
import { BklitAreaSeriesChart, BklitLineSeriesChart } from '../charts/bklitInsightsCharts';

function seriesHasNonZeroValues(series, dataKeys, dataKey) {
  const keys = dataKeys?.length ? dataKeys.map((ds) => ds.key) : [dataKey];
  return series.some((row) =>
    keys.some((key) => Number(row?.[key]) > 0));
}

function InsightChartCard({ chart }) {
  const {
    title,
    type = 'line',
    data = [],
    xKey = 'date',
    dataKey = 'value',
    dataKeys,
    loading,
    emptyLabel = 'No data for this period',
    emptyWhenAllZero = false,
    headerAction,
    height = 200,
  } = chart;

  const series = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const funnelStages = type === 'funnel' ? (chart.stages || []) : [];
  const hasFunnelData = funnelStages.some((s) => (s?.value ?? 0) > 0);
  const hasData = type === 'funnel'
    ? hasFunnelData
    : series.length > 0
      && (!emptyWhenAllZero || seriesHasNonZeroValues(series, dataKeys, dataKey));

  const header = (
    <div className="flex items-center justify-between gap-2 mb-2">
      {title ? (
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
          {title}
        </p>
      ) : (
        <span />
      )}
      {headerAction}
    </div>
  );

  if (type === 'funnel') {
    if (loading) {
      return (
        <div className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-4 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="w-full" style={{ height }} />
        </div>
      );
    }

    const stages = (chart.stages || []).map((stage, index) => ({
      label: stage.label,
      value: stage.value ?? 0,
      color: stage.color || FUNNEL_CHART_COLORS[index % FUNNEL_CHART_COLORS.length],
    }));

    if (!hasData) {
      return (
        <div className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-4">
          {header}
          <div
            className="flex items-center justify-center text-xs text-[var(--color-text-muted)] italic text-center px-3"
            style={{ height, minHeight: height }}
          >
            {emptyLabel}
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-4 min-h-0">
        {header}
        <FunnelChart
          data={stages}
          layers={chart.layers ?? 3}
          minHeight={height}
          showRates={chart.showRates !== false}
        />
      </div>
    );
  }

  if (loading || hasData) {
    const chartBody = type === 'area' ? (
      <BklitAreaSeriesChart
        dataKey={dataKey}
        height={height}
        loading={loading}
        series={series}
        xKey={xKey}
      />
    ) : type === 'line' ? (
      <BklitLineSeriesChart
        dataKeys={dataKeys?.length ? dataKeys : [{ key: dataKey, name: dataKey, color: 'primary' }]}
        height={height}
        loading={loading}
        series={series}
        xKey={xKey}
      />
    ) : null;

    if (chartBody) {
      return (
        <div className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-4 min-h-0">
          {header}
          {chartBody}
        </div>
      );
    }
  }

  if (!hasData) {
    return (
      <div className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-4">
        {header}
        <div
          className="flex items-center justify-center text-xs text-[var(--color-text-muted)] italic text-center px-3"
          style={{ height, minHeight: height }}
        >
          {emptyLabel}
        </div>
      </div>
    );
  }

  return null;
}

export default function InsightsChartGrid({
  charts = [],
  columns = 2,
  eager = false,
  className = '',
}) {
  if (!charts.length) return null;

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 lg:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
  }[columns] || 'grid-cols-1 lg:grid-cols-2';

  return (
    <div className={`grid ${gridCols} gap-4 ${className}`} data-charts-eager={eager || undefined}>
      {charts.map((chart) => (
        <InsightChartCard key={chart.id || chart.title} chart={chart} />
      ))}
    </div>
  );
}
