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

  const shellClass = `p-3 min-w-0 overflow-hidden ${className}`;

  if (!loading && series.length === 0) {
    return (
      <ChartSurface title={title} className={shellClass} height={height}>
        <ChartEmptyState
          height={height}
          aspectRatio={false}
          label="No location data yet — opens and clicks from real devices will populate city geo."
        />
      </ChartSurface>
    );
  }

  return (
    <ChartSurface title={title} className={shellClass} height={height}>
      {type === 'donut' ? (
        <BklitBreakdownBars
          emptyLabel="No location data yet"
          fillHeight
          height={height}
          items={series}
          nameKey="label"
          valueKey="value"
        />
      ) : (
        <BklitCategoryBarChart
          emptyLabel="No location data yet"
          fill="var(--color-action-primary)"
          fillHeight
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
