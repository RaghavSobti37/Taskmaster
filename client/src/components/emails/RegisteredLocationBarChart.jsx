import React from 'react';
import ChartSurface from '../ui/ChartSurface';
import { BklitHorizontalBarChart } from '../charts/bklitInsightsCharts';
import { eventCityLabel } from '../../utils/mailEventLocation';

const BAR_FILL = 'var(--color-brand-teal)';

const resolveCity = (d) =>
  eventCityLabel({ displayCity: d.city || d.label || d.location })
  || d.city
  || d.label
  || d.location
  || 'Unknown';

const hasEngagement = (d, histogram) => {
  const opens = Number(d.opens) || 0;
  const clicks = Number(d.clicks) || 0;
  const count = Number(d.count) || 0;
  return histogram ? count > 0 || opens > 0 || clicks > 0 : opens > 0 || clicks > 0;
};

export default function RegisteredLocationBarChart({
  title,
  data = [],
  height = 256,
  limit = 12,
  variant = 'horizontal',
  onLocationClick,
  emptyMessage = 'No engagement yet — opens and clicks appear by each recipient\'s real city.',
  className = '',
  loading = false,
}) {
  const histogram = variant === 'histogram';

  const series = (data || [])
    .filter((d) => hasEngagement(d, histogram))
    .sort((a, b) => {
      if (histogram) return (Number(b.count) || 0) - (Number(a.count) || 0);
      return (b.total ?? ((Number(b.opens) || 0) + (Number(b.clicks) || 0)))
        - (a.total ?? ((Number(a.opens) || 0) + (Number(a.clicks) || 0)));
    })
    .slice(0, limit)
    .map((d) => {
      const city = resolveCity(d);
      const opens = Number(d.opens) || 0;
      const clicks = Number(d.clicks) || 0;
      const count = Number(d.count) || 0;
      return {
        city,
        opens,
        clicks,
        count: count > 0 ? count : opens + clicks,
      };
    });

  if (!loading && series.length === 0) {
    return (
      <ChartSurface title={title} className={className} height={height}>
        <div
          className="flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)] italic border border-dashed border-[var(--color-bg-border)] rounded-xl px-4 text-center"
          style={{ height, minHeight: height }}
        >
          {emptyMessage}
        </div>
      </ChartSurface>
    );
  }

  const chartHeight = Math.max(height, series.length * 36);

  return (
    <ChartSurface title={title} className={className} height={chartHeight}>
      <BklitHorizontalBarChart
        categoryKey="city"
        dataKeys={
          histogram
            ? [{ key: 'count', fill: BAR_FILL }]
            : [
                { key: 'opens', fill: '#38bdf8' },
                { key: 'clicks', fill: '#10b981' },
              ]
        }
        emptyLabel={emptyMessage}
        height={chartHeight}
        loading={loading}
        onCategoryClick={onLocationClick}
        series={series}
        stacked={!histogram}
      />
    </ChartSurface>
  );
}
