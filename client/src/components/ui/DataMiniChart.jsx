import React, { useMemo } from 'react';
import ChartSurface from './ChartSurface';
import HorizontalBarList from './HorizontalBarList';
import { BklitCategoryBarChart, BklitBreakdownBars, ChartEmptyState } from '../charts/bklitInsightsCharts';

const DataMiniChart = React.memo(function DataMiniChart({
  title,
  type = 'bar',
  data = [],
  height = 112,
  className = '',
  loading = false,
  emptyLabel = 'No data yet',
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
          label={emptyLabel}
        />
      </ChartSurface>
    );
  }

  return (
    <ChartSurface title={title} className={shellClass} height={height}>
      {type === 'horizontalBar' ? (
        <HorizontalBarList items={series} className="pt-0.5" />
      ) : type === 'donut' ? (
        <BklitBreakdownBars
          emptyLabel={emptyLabel}
          fillHeight
          height={height}
          items={series}
          nameKey="label"
          valueKey="value"
        />
      ) : (
        <BklitCategoryBarChart
          emptyLabel={emptyLabel}
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
