import React, { useMemo } from 'react';
import ChartSurface from './ChartSurface';
import { BklitCategoryBarChart, BklitBreakdownBars, ChartEmptyState } from '../charts/bklitInsightsCharts';

const DataMiniChart = React.memo(function DataMiniChart({
  title,
  type = 'bar',
  data = [],
  height = 112,
  className = '',
  loading = false,
}) {
  const series = useMemo(
    () => (data || []).filter((d) => d && Number(d.value) > 0),
    [data],
  );

  if (!loading && series.length === 0) {
    return (
      <ChartSurface title={title} className={`p-3 bg-[var(--color-bg-surface)] ${className}`} height={height}>
        <ChartEmptyState
          height={height}
          label="No location data yet — opens and clicks from real devices will populate city geo."
        />
      </ChartSurface>
    );
  }

  return (
    <ChartSurface title={title} className={`p-3 bg-[var(--color-bg-surface)] ${className}`} height={height}>
      {type === 'donut' ? (
        <BklitBreakdownBars
          aspectRatio="2.2 / 1"
          emptyLabel="No location data yet"
          height={height}
          items={series}
          nameKey="label"
          valueKey="value"
        />
      ) : (
        <BklitCategoryBarChart
          aspectRatio="2.2 / 1"
          emptyLabel="No location data yet"
          fill="var(--color-action-primary)"
          height={height}
          labelKey="label"
          loading={loading}
          series={series}
          valueKey="value"
        />
      )}
    </ChartSurface>
  );
});

export default DataMiniChart;
