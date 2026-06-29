import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartSurface, { CHART_MUTED } from './ChartSurface';
import { Skeleton } from './primitives';

const SERIES_COLORS = {
  primary: 'var(--color-action-primary)',
  mint: 'var(--color-pastel-mint-text)',
  apricot: 'var(--color-pastel-apricot-text)',
  blue: 'var(--color-pastel-blue-text)',
  rose: 'var(--color-pastel-rose-text)',
};

function seriesColor(token) {
  return SERIES_COLORS[token] || SERIES_COLORS.primary;
}

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

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-4 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="w-full" style={{ height }} />
      </div>
    );
  }

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

  if (type === 'funnel') {
    const stages = chart.stages || [];
    const total = stages[0]?.value ?? 0;
    const stageColors = chart.stageColors || [
      'bg-[var(--color-action-primary)]',
      'bg-violet-500/80',
      'bg-amber-500/80',
      'bg-orange-500/70',
      'bg-[var(--color-pastel-mint-text)]',
    ];

    return (
      <div className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-4 min-h-0">
        {header}
        <div className="space-y-3 overflow-y-auto" style={{ maxHeight: height, minHeight: height }}>
          {stages.map((stage, idx) => {
            const prevValue = idx === 0 ? stage.value : stages[idx - 1].value;
            const widthPct = total > 0
              ? Math.max(12, Math.round((stage.value / total) * 100))
              : 12;
            const stepPct = idx > 0 && prevValue > 0
              ? Math.round((stage.value / prevValue) * 100)
              : null;
            const dropPct = idx > 0 && prevValue > 0
              ? Math.round(((prevValue - stage.value) / prevValue) * 100)
              : null;

            return (
              <div key={stage.label || idx}>
                {idx > 0 && dropPct != null && prevValue > 0 && (
                  <p className="text-[9px] text-[var(--color-text-muted)] mb-1 pl-1">
                    {dropPct}% drop · {stepPct}% retained
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0 flex justify-center">
                    <div
                      className={`h-8 rounded-md flex items-center justify-between px-2 ${stageColors[idx] || stageColors[0]}`}
                      style={{ width: `${widthPct}%`, minWidth: '3rem' }}
                    >
                      <span className="text-[10px] font-bold text-white truncate">{stage.label}</span>
                      <span className="text-xs font-black font-mono tabular-nums text-white shrink-0 ml-2">
                        {stage.value}
                      </span>
                    </div>
                  </div>
                  {total > 0 && (
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] tabular-nums w-10 text-right shrink-0">
                      {Math.round((stage.value / total) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const renderChart = () => {
    if (type === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid {...CHART_MUTED.grid} vertical={false} />
            <XAxis dataKey={xKey} tick={CHART_MUTED.axis} axisLine={false} tickLine={false} />
            <YAxis tick={CHART_MUTED.axis} axisLine={false} tickLine={false} width={32} />
            <Tooltip contentStyle={CHART_MUTED.tooltip} cursor={{ fill: 'var(--color-bg-secondary)' }} />
            <Bar dataKey={dataKey} fill={SERIES_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (type === 'area') {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid {...CHART_MUTED.grid} vertical={false} />
            <XAxis dataKey={xKey} tick={CHART_MUTED.axis} axisLine={false} tickLine={false} />
            <YAxis tick={CHART_MUTED.axis} axisLine={false} tickLine={false} width={32} />
            <Tooltip contentStyle={CHART_MUTED.tooltip} />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={SERIES_COLORS.primary}
              fill="var(--color-action-primary)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    const keys = dataKeys?.length
      ? dataKeys
      : [{ key: dataKey, name: title || dataKey, color: 'primary' }];

    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid {...CHART_MUTED.grid} vertical={false} />
          <XAxis dataKey={xKey} tick={CHART_MUTED.axis} axisLine={false} tickLine={false} />
          <YAxis tick={CHART_MUTED.axis} axisLine={false} tickLine={false} width={32} />
          <Tooltip contentStyle={CHART_MUTED.tooltip} />
          {keys.map((ds) => (
            <Line
              key={ds.key}
              type="monotone"
              dataKey={ds.key}
              name={ds.name || ds.key}
              stroke={seriesColor(ds.color)}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-4 min-h-0">
      {header}
      <ChartSurface height={height}>{renderChart()}</ChartSurface>
    </div>
  );
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
