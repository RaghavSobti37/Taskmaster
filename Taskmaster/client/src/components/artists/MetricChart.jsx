import React from 'react';
import ChartSurface from '../ui/ChartSurface';
import { BklitAreaSeriesChart } from '../charts/bklitInsightsCharts';

const PLATFORM_LABELS = {
  spotify: 'Spotify Followers',
  youtube: 'YouTube Subscribers',
  instagram: 'Instagram Followers',
  facebook: 'Facebook Followers',
};

export default function MetricChart({ chartData, activeTab, rangeLabel }) {
  const metricLabel = PLATFORM_LABELS[activeTab] || 'Followers';
  const title = `Audience History — ${metricLabel.split(' ')[0]}`;

  return (
    <ChartSurface
      title={title}
      actions={
        rangeLabel ? (
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            {rangeLabel}
          </span>
        ) : null
      }
      height={220}
      className="min-h-[220px]"
    >
      <BklitAreaSeriesChart
        dataKey="value"
        emptyLabel="Sync feeds to populate history"
        fill="var(--color-action-primary)"
        height={220}
        series={chartData || []}
        xKey="label"
      />
    </ChartSurface>
  );
}
