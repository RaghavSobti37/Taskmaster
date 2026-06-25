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
import ChartSurface, { CHART_MUTED } from '../ui/ChartSurface';
import { eventCityLabel } from '../../utils/mailEventLocation';

const BAR_FILL = '#126d5e';

const tooltipStyle = {
  backgroundColor: '#1e293b',
  borderColor: '#334155',
  borderRadius: '12px',
  fontSize: '11px',
  fontFamily: 'monospace',
};

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

const HistogramTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      className="rounded border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-[11px] font-mono shadow-sm"
      style={CHART_MUTED.tooltip}
    >
      <p className="font-bold text-[var(--color-text-primary)] mb-1">{row.city}</p>
      <p className="text-[var(--color-text-muted)]">Engaged: {row.count}</p>
      <p className="text-[var(--color-text-muted)]">Opens: {row.opens}</p>
      <p className="text-[var(--color-text-muted)]">Clicks: {row.clicks}</p>
    </div>
  );
};

export default function RegisteredLocationBarChart({
  title,
  data = [],
  height = 256,
  limit = 12,
  variant = 'horizontal',
  onLocationClick,
  emptyMessage = 'No engagement yet — opens and clicks appear by city from each event\'s IP geolocation.',
  className = '',
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

  const handleBarClick = (state) => {
    if (!onLocationClick || !state?.activePayload?.[0]?.payload?.city) return;
    onLocationClick(state.activePayload[0].payload.city);
  };

  if (series.length === 0) {
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
  const yAxisWidth = Math.min(
    140,
    Math.max(72, ...series.map((s) => String(s.city).length * 6)),
  );

  if (histogram) {
    return (
      <ChartSurface title={title} className={className} height={chartHeight}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={series}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
            onClick={handleBarClick}
          >
            <CartesianGrid {...CHART_MUTED.grid} horizontal={false} />
            <XAxis
              type="number"
              tick={CHART_MUTED.axis}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              dataKey="city"
              type="category"
              tick={CHART_MUTED.axis}
              axisLine={false}
              tickLine={false}
              width={yAxisWidth}
              interval={0}
            />
            <Tooltip content={<HistogramTooltip />} cursor={{ fill: 'var(--color-bg-secondary)' }} />
            <Bar
              dataKey="count"
              name="Engaged"
              fill={BAR_FILL}
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
              minPointSize={2}
              cursor={onLocationClick ? 'pointer' : undefined}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartSurface>
    );
  }

  return (
    <ChartSurface title={title} className={className} height={chartHeight}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={series}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
          onClick={handleBarClick}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
          <XAxis type="number" stroke="#94a3b8" fontSize={10} allowDecimals={false} />
          <YAxis
            dataKey="city"
            type="category"
            stroke="#94a3b8"
            fontSize={10}
            width={yAxisWidth}
            tick={{ fontSize: 10 }}
            interval={0}
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
