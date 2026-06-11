import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import ChartSurface, { CHART_MUTED } from '../ui/ChartSurface';
import { formatNumber } from '../../config/integrations.config';

const PLATFORM_LABELS = {
  spotify: 'Spotify Followers',
  youtube: 'YouTube Subscribers',
  instagram: 'Instagram Followers',
  facebook: 'Facebook Followers',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const metricName = payload[0].name || 'Followers';
  return (
    <div
      className="rounded border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-[11px] shadow-sm"
      style={CHART_MUTED.tooltip}
    >
      <p className="tm-widget-label mb-1 !text-[9px]">{label}</p>
      <p className="font-bold tabular-nums text-[var(--color-action-primary)]">
        {metricName}: {formatNumber(payload[0].value)}
      </p>
    </div>
  );
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
      {!chartData?.length ? (
        <div className="flex items-center justify-center h-full text-[11px] font-bold text-[var(--color-text-muted)]">
          Sync feeds to populate history
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="artistAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-action-primary)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-action-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} {...CHART_MUTED.grid} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={CHART_MUTED.axis} />
            <YAxis axisLine={false} tickLine={false} tick={CHART_MUTED.axis} tickFormatter={formatNumber} width={48} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              name={metricLabel}
              stroke="var(--color-action-primary)"
              strokeWidth={2}
              fill="url(#artistAreaGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartSurface>
  );
}
