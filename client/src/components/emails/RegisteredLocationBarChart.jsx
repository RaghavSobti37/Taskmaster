import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import ChartSurface from '../ui/ChartSurface';
import { eventCityLabel } from '../../utils/mailEventLocation';

const tooltipStyle = {
  backgroundColor: '#1e293b',
  borderColor: '#334155',
  borderRadius: '12px',
  fontSize: '11px',
  fontFamily: 'monospace',
};

export default function RegisteredLocationBarChart({
  title,
  data = [],
  height = 256,
  limit = 12,
  onLocationClick,
  emptyMessage = 'No engagement yet — opens and clicks appear by each recipient\'s registered CRM city.',
  className = '',
}) {
  const series = (data || [])
    .filter((d) => (Number(d.opens) || 0) > 0 || (Number(d.clicks) || 0) > 0)
    .sort((a, b) => (b.total ?? (b.opens + b.clicks)) - (a.total ?? (a.opens + a.clicks)))
    .slice(0, limit)
    .map((d) => ({
      city: eventCityLabel({ displayCity: d.city || d.label || d.location }) || d.city || d.label || d.location || 'Unknown',
      opens: Number(d.opens) || 0,
      clicks: Number(d.clicks) || 0,
    }));

  if (series.length === 0) {
    return (
      <ChartSurface title={title} className={className} height={height}>
        <div className="h-full flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)] italic border border-dashed border-[var(--color-bg-border)] rounded-xl px-4 text-center">
          {emptyMessage}
        </div>
      </ChartSurface>
    );
  }

  return (
    <ChartSurface title={title} className={className} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={series}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
          onClick={(state) => {
            if (!onLocationClick || !state?.activePayload?.[0]?.payload?.city) return;
            onLocationClick(state.activePayload[0].payload.city);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
          <XAxis type="number" stroke="#94a3b8" fontSize={10} />
          <YAxis
            dataKey="city"
            type="category"
            stroke="#94a3b8"
            fontSize={10}
            width={Math.min(120, Math.max(72, ...series.map((s) => String(s.city).length * 6)))}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [String(value), name]}
          />
          <Bar dataKey="opens" stackId="geo" fill="#38bdf8" radius={[0, 0, 0, 0]} name="Opens" />
          <Bar dataKey="clicks" stackId="geo" fill="#10b981" radius={[0, 6, 6, 0]} name="Clicks" />
        </BarChart>
      </ResponsiveContainer>
    </ChartSurface>
  );
}
