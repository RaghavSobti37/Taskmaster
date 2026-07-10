import React, { useMemo } from 'react';
import {
  BklitAreaSeriesChart,
  BklitCategoryBarChart,
  BklitLineSeriesChart,
  BklitBreakdownBars,
  ChartEmptyState,
} from '../charts/bklitInsightsCharts';

const DEFAULT_HEIGHT = 192;

export default function InsightsChart({
  type = 'area',
  data = [],
  dataKey = 'value',
  dataKeys,
  xKey = 'date',
  colors,
  height = DEFAULT_HEIGHT,
  emptyLabel = 'No data recorded for this period',
  loading = false,
  tooltipFormatter: _tooltipFormatter,
}) {
  const series = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const keys = dataKeys || [{ key: dataKey, name: dataKey, color: 'mint' }];

  if (type === 'donut') {
    const donutItems = series
      .filter((d) => Number(d[dataKey] ?? d.value) > 0)
      .map((d) => ({
        name: String(d[xKey === 'date' ? 'label' : xKey] ?? d.label ?? d.name ?? ''),
        value: Number(d[dataKey] ?? d.value),
      }));

    if (!donutItems.length && !loading) {
      return <ChartEmptyState height={height} label={emptyLabel} />;
    }

    return (
      <BklitBreakdownBars
        emptyLabel={emptyLabel}
        height={height}
        items={donutItems}
      />
    );
  }

  if (type === 'bar') {
    return (
      <BklitCategoryBarChart
        dataKeys={keys.map((k, i) => ({
          key: k.key,
          fill: colors?.[i] || undefined,
        }))}
        emptyLabel={emptyLabel}
        height={height}
        labelKey={xKey}
        loading={loading}
        series={series}
        valueKey={keys[0]?.key || dataKey}
      />
    );
  }

  if (type === 'line') {
    return (
      <BklitLineSeriesChart
        dataKeys={keys}
        emptyLabel={emptyLabel}
        height={height}
        loading={loading}
        series={series}
        xKey={xKey}
      />
    );
  }

  return (
    <BklitAreaSeriesChart
      dataKey={keys[0]?.key || dataKey}
      emptyLabel={emptyLabel}
      fill={colors?.[0] || 'var(--chart-line-primary)'}
      height={height}
      loading={loading}
      series={series}
      xKey={xKey}
    />
  );
}
