import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  XAxis,
} from 'recharts';
import ChartSurface, { CHART_MUTED } from './ChartSurface';

const CHART_COLORS = [
  'var(--color-action-primary)',
  'var(--color-pastel-mint-text)',
  'var(--color-pastel-apricot-text)',
  'var(--color-pastel-blue-text)',
  'var(--color-pastel-rose-text)',
  'var(--color-pastel-slate-text)',
];

const DataMiniChart = React.memo(function DataMiniChart({
  title,
  type = 'bar',
  data = [],
  height = 112,
  className = '',
}) {
  const series = useMemo(
    () => (data || []).filter((d) => d && Number(d.value) > 0),
    [data],
  );
  if (series.length === 0) {
    return (
      <ChartSurface title={title} className={`p-3 bg-[var(--color-bg-surface)] ${className}`} height={height}>
        <div className="flex items-center justify-center text-[11px] text-[var(--color-text-muted)] italic text-center px-3" style={{ height, minHeight: height }}>
          No location data yet — opens and clicks from real devices will populate city geo.
        </div>
      </ChartSurface>
    );
  }

  return (
    <ChartSurface title={title} className={`p-3 bg-[var(--color-bg-surface)] ${className}`} height={height}>
      {type === 'donut' ? (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={series}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
            >
              {series.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={CHART_MUTED.tooltip} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={series} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid {...CHART_MUTED.grid} vertical={false} />
            <XAxis dataKey="label" tick={CHART_MUTED.axis} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={CHART_MUTED.tooltip} cursor={{ fill: 'var(--color-bg-secondary)' }} />
            <Bar dataKey="value" fill="var(--color-action-primary)" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartSurface>
  );
});

export default DataMiniChart;
