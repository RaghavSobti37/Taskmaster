import React from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card } from './primitives';

const CHART_COLORS = [
  'var(--color-action-primary)',
  'var(--color-pastel-mint-text)',
  'var(--color-pastel-apricot-text)',
  'var(--color-pastel-blue-text)',
  'var(--color-pastel-rose-text)',
  'var(--color-pastel-slate-text)',
];

const tooltipStyle = {
  backgroundColor: 'var(--color-bg-surface)',
  border: '1px solid var(--color-bg-border)',
  borderRadius: '8px',
  fontSize: '11px',
  fontWeight: 600,
};

export default function DataMiniChart({
  title,
  type = 'bar',
  data = [],
  height = 112,
  className = '',
}) {
  const series = (data || []).filter((d) => d && Number(d.value) > 0);
  const empty = series.length === 0;

  return (
    <Card className={`p-3 flex flex-col min-h-0 ${className}`}>
      {title && (
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-2 shrink-0">
          {title}
        </p>
      )}
      <div className="w-full flex-1 min-h-0" style={{ height }}>
        {empty ? (
          <div className="h-full flex items-center justify-center text-[10px] text-[var(--color-text-muted)] italic">
            No data
          </div>
        ) : type === 'donut' ? (
          <ResponsiveContainer width="100%" height="100%">
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
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--color-bg-secondary)' }} />
              <Bar dataKey="value" fill="var(--color-action-primary)" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
