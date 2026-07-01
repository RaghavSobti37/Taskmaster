import React, { useMemo } from 'react';
import { curveMonotoneX } from '@visx/curve';
import {
  Area,
  AreaChart,
  AreaChartLoading,
  Bar,
  BarChart,
  BarChartLoading,
  BarXAxis,
  BarYAxis,
  Line,
  LineChart,
  LineChartLoading,
  ChartTooltip,
  Grid,
  XAxis,
  BK_CHART_MARGIN,
  BK_LINE_COLORS,
  normalizeTimeSeriesRows,
  toCategoryBarRows,
  seriesHasValues,
} from './bklitInsightsExports';

const INSIGHT_MARGIN = { ...BK_CHART_MARGIN, left: 36, bottom: 28 };
const COMPACT_MARGIN = { top: 8, right: 12, bottom: 28, left: 40 };
const H_BAR_MARGIN = { top: 8, right: 16, bottom: 8, left: 8 };

const EMPTY_CLASS =
  'flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider text-center px-3';

function chartStyle({ height, aspectRatio }) {
  if (aspectRatio) return undefined;
  return { height, minHeight: height };
}

export function ChartEmptyState({ label, height = 192, aspectRatio }) {
  return (
    <div className={EMPTY_CLASS} style={{ ...chartStyle({ height, aspectRatio }), aspectRatio }}>
      {label}
    </div>
  );
}

function resolveStroke(seriesItem) {
  if (seriesItem.stroke) return seriesItem.stroke;
  if (seriesItem.color && BK_LINE_COLORS[seriesItem.color]) return BK_LINE_COLORS[seriesItem.color];
  return BK_LINE_COLORS.primary;
}

export function BklitLineSeriesChart({
  series,
  dataKeys,
  xKey = 'date',
  loading,
  height = 200,
  aspectRatio,
  emptyLabel = 'No data recorded for this period',
}) {
  const chartData = useMemo(() => normalizeTimeSeriesRows(series, xKey), [series, xKey]);
  const keys = dataKeys?.length ? dataKeys : [];
  const hasData = chartData.length > 0 && seriesHasValues(chartData, keys.map((k) => k.key));

  if (loading) {
    return (
      <LineChartLoading
        aspectRatio={aspectRatio}
        gridShimmerSync
        label="Loading"
        margin={INSIGHT_MARGIN}
        stroke="var(--foreground)"
        strokeOpacity={0.5}
        style={chartStyle({ height, aspectRatio })}
      />
    );
  }

  if (!hasData) return <ChartEmptyState aspectRatio={aspectRatio} height={height} label={emptyLabel} />;

  return (
    <LineChart
      aspectRatio={aspectRatio}
      data={chartData}
      margin={INSIGHT_MARGIN}
      status="ready"
      style={chartStyle({ height, aspectRatio })}
      xDataKey={xKey}
    >
      <Grid horizontal />
      {keys.map((ds) => (
        <Line key={ds.key} dataKey={ds.key} stroke={resolveStroke(ds)} strokeWidth={2} />
      ))}
      <XAxis tickMode="data" />
      <ChartTooltip />
    </LineChart>
  );
}

export function BklitAreaSeriesChart({
  series,
  dataKey = 'value',
  xKey = 'date',
  loading,
  height = 200,
  aspectRatio,
  fill = 'var(--chart-line-primary)',
  fillOpacity = 0.35,
  strokeWidth = 2,
  curve,
  emptyLabel = 'No data recorded for this period',
}) {
  const chartData = useMemo(() => normalizeTimeSeriesRows(series, xKey), [series, xKey]);
  const hasData = chartData.length > 0 && seriesHasValues(chartData, dataKey);

  if (loading) {
    return (
      <AreaChartLoading
        aspectRatio={aspectRatio}
        gridShimmerSync
        label="Loading"
        margin={INSIGHT_MARGIN}
        stroke="var(--foreground)"
        strokeOpacity={0.5}
        style={chartStyle({ height, aspectRatio })}
      />
    );
  }

  if (!hasData) return <ChartEmptyState aspectRatio={aspectRatio} height={height} label={emptyLabel} />;

  return (
    <AreaChart
      aspectRatio={aspectRatio}
      data={chartData}
      margin={INSIGHT_MARGIN}
      status="ready"
      style={chartStyle({ height, aspectRatio })}
      xDataKey={xKey}
    >
      <Grid horizontal />
      <Area
        curve={curve}
        dataKey={dataKey}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={fill}
        strokeWidth={strokeWidth}
      />
      <XAxis tickMode="data" />
      <ChartTooltip />
    </AreaChart>
  );
}

export function BklitMultiLineChart({
  series,
  lines,
  xKey = 'date',
  loading,
  height = 200,
  aspectRatio,
  emptyLabel = 'No data recorded for this period',
  showMarkers = false,
}) {
  const chartData = useMemo(() => normalizeTimeSeriesRows(series, xKey), [series, xKey]);
  const lineKeys = lines?.map((l) => l.key) ?? [];
  const hasData = chartData.length > 0 && seriesHasValues(chartData, lineKeys);

  if (loading) {
    return (
      <LineChartLoading
        aspectRatio={aspectRatio}
        gridShimmerSync
        label="Loading"
        margin={COMPACT_MARGIN}
        stroke="var(--foreground)"
        strokeOpacity={0.5}
        style={chartStyle({ height, aspectRatio })}
      />
    );
  }

  if (!hasData) return <ChartEmptyState aspectRatio={aspectRatio} height={height} label={emptyLabel} />;

  return (
    <LineChart
      aspectRatio={aspectRatio}
      data={chartData}
      margin={COMPACT_MARGIN}
      status="ready"
      style={chartStyle({ height, aspectRatio })}
      xDataKey={xKey}
    >
      <Grid horizontal />
      {lines.map((line) => (
        <Line
          key={line.key}
          dataKey={line.key}
          showMarkers={showMarkers}
          stroke={resolveStroke(line)}
          strokeWidth={line.strokeWidth ?? 2}
        />
      ))}
      <XAxis tickMode="data" />
      <ChartTooltip />
    </LineChart>
  );
}

export function BklitCategoryBarChart({
  series,
  labelKey = 'label',
  valueKey = 'value',
  dataKeys,
  loading,
  height = 200,
  aspectRatio = '2 / 1',
  emptyLabel = 'No data recorded for this period',
  fill = 'var(--chart-line-primary)',
  stacked = false,
}) {
  const chartData = useMemo(() => toCategoryBarRows(series, labelKey, valueKey), [series, labelKey, valueKey]);
  const keys = dataKeys?.length ? dataKeys : [{ key: valueKey, fill }];
  const valueFields = keys.map((k) => k.key);
  const hasData = chartData.length > 0 && seriesHasValues(chartData, valueFields);

  if (loading) {
    return (
      <BarChartLoading
        aspectRatio={aspectRatio}
        className="w-full"
        margin={COMPACT_MARGIN}
      />
    );
  }

  if (!hasData) return <ChartEmptyState aspectRatio={aspectRatio} height={height} label={emptyLabel} />;

  return (
    <BarChart
      aspectRatio={aspectRatio}
      barGap={0.25}
      data={chartData}
      margin={COMPACT_MARGIN}
      stacked={stacked}
      status="ready"
      style={chartStyle({ height, aspectRatio })}
      xDataKey="name"
    >
      <Grid horizontal />
      {keys.map((k) => (
        <Bar
          key={k.key}
          dataKey={k.key}
          fill={k.fill || fill}
          fillOpacity={k.fillOpacity ?? 1}
        />
      ))}
      <BarXAxis showAllLabels maxLabels={16} />
      <ChartTooltip />
    </BarChart>
  );
}

export function BklitHorizontalBarChart({
  series,
  categoryKey = 'city',
  dataKeys,
  loading,
  height = 256,
  aspectRatio,
  emptyLabel = 'No data recorded',
  stacked = false,
  onCategoryClick,
}) {
  const chartData = useMemo(() => (Array.isArray(series) ? series : []), [series]);
  const keys = dataKeys?.length ? dataKeys : [{ key: 'value', fill: 'var(--chart-line-primary)' }];
  const valueFields = keys.map((k) => k.key);
  const hasData = chartData.length > 0 && seriesHasValues(chartData, valueFields);
  const chartHeight = Math.max(height, chartData.length * 36);

  if (loading) {
    return (
      <BarChartLoading
        aspectRatio={aspectRatio || '3 / 2'}
        margin={H_BAR_MARGIN}
        style={{ minHeight: chartHeight }}
      />
    );
  }

  if (!hasData) {
    return (
      <ChartEmptyState
        height={height}
        label={emptyLabel}
      />
    );
  }

  return (
    <div className="space-y-2">
      <BarChart
        aspectRatio={aspectRatio}
        barGap={0.2}
        data={chartData}
        margin={H_BAR_MARGIN}
        orientation="horizontal"
        stacked={stacked}
        status="ready"
        style={{ minHeight: chartHeight, width: '100%' }}
        xDataKey={categoryKey}
      >
        <Grid horizontal />
        {keys.map((k) => (
          <Bar key={k.key} dataKey={k.key} fill={k.fill || 'var(--chart-line-primary)'} />
        ))}
        <BarYAxis showAllLabels maxLabels={20} />
        <ChartTooltip />
      </BarChart>
      {onCategoryClick ? (
        <div className="flex flex-wrap gap-1.5">
          {chartData.map((row) => (
            <button
              key={String(row[categoryKey])}
              className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)] hover:border-[var(--color-action-primary)]"
              type="button"
              onClick={() => onCategoryClick(row[categoryKey])}
            >
              {row[categoryKey]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BklitBreakdownBars({
  items,
  nameKey = 'name',
  valueKey = 'value',
  height = 200,
  aspectRatio = '2 / 1',
  emptyLabel = 'No data',
}) {
  const chartData = useMemo(
    () => (items || []).filter((d) => Number(d[valueKey]) > 0).map((d) => ({
      ...d,
      name: String(d[nameKey]),
      value: Number(d[valueKey]),
    })),
    [items, nameKey, valueKey],
  );

  if (!chartData.length) {
    return <ChartEmptyState aspectRatio={aspectRatio} height={height} label={emptyLabel} />;
  }

  return (
    <BarChart
      aspectRatio={aspectRatio}
      barGap={0.25}
      data={chartData}
      margin={COMPACT_MARGIN}
      status="ready"
      style={chartStyle({ height, aspectRatio })}
      xDataKey="name"
    >
      <Grid horizontal />
      <Bar dataKey="value" fill="var(--chart-line-primary)" />
      <BarXAxis showAllLabels />
      <ChartTooltip />
    </BarChart>
  );
}

export { curveMonotoneX, BK_LINE_COLORS, normalizeTimeSeriesRows, toCategoryBarRows };
