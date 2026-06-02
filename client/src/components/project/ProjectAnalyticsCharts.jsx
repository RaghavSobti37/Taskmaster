import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import ChartSurface, { CHART_MUTED } from '../ui/ChartSurface';

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#94a3b8', '#ec4899'];

const EmptyChart = ({ message }) => (
  <div className="h-[200px] flex items-center justify-center text-xs text-[var(--color-text-muted)] opacity-60">
    {message}
  </div>
);

export const TaskStatusPie = ({ byStatus }) => {
  const data = [
    { name: 'Done', value: byStatus?.done || 0 },
    { name: 'In Progress', value: byStatus?.inProgress || 0 },
    { name: 'Todo', value: byStatus?.todo || 0 },
    { name: 'In Review', value: byStatus?.inReview || 0 },
  ].filter((d) => d.value > 0);

  return (
    <ChartSurface title="Task Status" height={200}>
      {data.length === 0 ? (
        <EmptyChart message="No tasks in range" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v, name) => [`${v} tasks`, name]} contentStyle={CHART_MUTED.tooltip} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartSurface>
  );
};

export const HoursMixPie = ({ hoursMix = [] }) => (
  <ChartSurface title="Hours Mix" height={200}>
    {hoursMix.length === 0 ? (
      <EmptyChart message="No hours logged" />
    ) : (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={hoursMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
            {hoursMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}h`, 'Hours']} contentStyle={CHART_MUTED.tooltip} />
        </PieChart>
      </ResponsiveContainer>
    )}
  </ChartSurface>
);

export const PriorityBarChart = ({ byPriority }) => {
  const data = [
    { name: 'Critical', count: byPriority?.critical || 0 },
    { name: 'High', count: byPriority?.high || 0 },
    { name: 'Medium', count: byPriority?.medium || 0 },
    { name: 'Low', count: byPriority?.low || 0 },
  ].filter((d) => d.count > 0);

  return (
    <ChartSurface title="Tasks by Priority" height={200}>
      {data.length === 0 ? (
        <EmptyChart message="No tasks in range" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid {...CHART_MUTED.grid} />
            <XAxis dataKey="name" tick={CHART_MUTED.axis} />
            <YAxis tick={CHART_MUTED.axis} allowDecimals={false} />
            <Tooltip formatter={(v) => [`${v} tasks`, 'Count']} contentStyle={CHART_MUTED.tooltip} />
            <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartSurface>
  );
};
