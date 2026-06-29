import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { CHART_MUTED } from './ChartSurface';

const DEFAULT_HEIGHT = 192;

const GRADIENTS = {
  mint: { stroke: '#81C995' },
  apricot: { stroke: '#F9AB00' },
  primary: { stroke: 'var(--color-action-primary)' },
};

const DONUT_PALETTE = ['#81C995', '#F28B82', '#8AB4F8', '#FDD663', '#C58AF9', '#7DD3FC'];

export default function InsightsChart({
  type = 'area',
  data = [],
  dataKey = 'value',
  dataKeys,
  xKey = 'date',
  colors,
  height = DEFAULT_HEIGHT,
  emptyLabel = 'No data recorded for this period',
  tooltipFormatter,
}) {
  const series = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const keys = dataKeys || [{ key: dataKey, name: dataKey, color: 'mint' }];

  if (series.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider"
        style={{ height, minHeight: height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const resolveColor = (keyConfig, idx) => {
    if (colors?.[idx]) return colors[idx];
    const preset = GRADIENTS[keyConfig.color] || GRADIENTS.primary;
    return preset.stroke;
  };

  if (type === 'donut') {
    const donutData = series.filter((d) => Number(d[dataKey] ?? d.value) > 0);
    if (!donutData.length) {
      return (
        <div
          className="w-full flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider"
          style={{ height, minHeight: height }}
        >
          {emptyLabel}
        </div>
      );
    }
    return (
      <div className="w-full" style={{ height, minHeight: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donutData}
              dataKey={dataKey}
              nameKey={xKey === 'date' ? 'label' : xKey}
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
            >
              {donutData.map((_, i) => (
                <Cell key={i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={CHART_MUTED.tooltip} formatter={tooltipFormatter} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const commonAxis = (
    <>
      <CartesianGrid {...CHART_MUTED.grid} />
      <XAxis dataKey={xKey} tick={CHART_MUTED.axis} axisLine={false} tickLine={false} />
      <YAxis tick={CHART_MUTED.axis} axisLine={false} tickLine={false} width={40} />
      <Tooltip
        contentStyle={CHART_MUTED.tooltip}
        labelClassName="font-mono text-xs"
        formatter={tooltipFormatter}
      />
    </>
  );

  if (type === 'bar') {
    return (
      <div className="w-full" style={{ height, minHeight: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
            {commonAxis}
            {keys.map((k, i) => (
              <Bar
                key={k.key}
                dataKey={k.key}
                name={k.name || k.key}
                fill={resolveColor(k, i)}
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'line') {
    return (
      <div className="w-full" style={{ height, minHeight: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
            {commonAxis}
            {keys.map((k, i) => (
              <Line
                key={k.key}
                type="monotone"
                dataKey={k.key}
                name={k.name || k.key}
                stroke={resolveColor(k, i)}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height, minHeight: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            {keys.map((k, i) => {
              const gradId = `insightsGrad-${k.key}-${i}`;
              const stroke = resolveColor(k, i);
              return (
                <linearGradient key={gradId} id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={stroke} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          {commonAxis}
          {keys.map((k, i) => {
            const stroke = resolveColor(k, i);
            const gradId = `insightsGrad-${k.key}-${i}`;
            return (
              <Area
                key={k.key}
                type="monotone"
                dataKey={k.key}
                name={k.name || k.key}
                stroke={stroke}
                fillOpacity={1}
                fill={`url(#${gradId})`}
                strokeWidth={2}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
