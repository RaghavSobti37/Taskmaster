import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { Card } from '../ui';

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#94a3b8', '#ec4899'];

const formatHoursTooltip = (value) => [`${Number(value).toFixed(1)}h`, 'Hours'];

const DivisionBarChart = ({ title, data, dataKey = 'hours', nameKey = 'name' }) => (
  <Card className="p-4 h-full flex flex-col">
    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
      {title}
    </p>
    <div className="flex-1 min-h-[200px]">
      {data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-[var(--color-text-muted)] opacity-60">
          No data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis type="number" tick={{ fontSize: 9 }} />
            <YAxis type="category" dataKey={nameKey} width={72} tick={{ fontSize: 8 }} />
            <Tooltip formatter={formatHoursTooltip} />
            <Bar dataKey={dataKey} fill="#6366f1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  </Card>
);

export const TaskStatusPie = ({ byStatus }) => {
  const data = [
    { name: 'Done', value: byStatus?.done || 0 },
    { name: 'In Progress', value: byStatus?.inProgress || 0 },
    { name: 'Todo', value: byStatus?.todo || 0 },
    { name: 'In Review', value: byStatus?.inReview || 0 },
  ].filter((d) => d.value > 0);

  return (
    <Card className="p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
        Task Status
      </p>
      <ResponsiveContainer width="100%" height={200}>
        {data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-xs text-[var(--color-text-muted)] opacity-60">
            No tasks in range
          </div>
        ) : (
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v, name) => [`${v} tasks`, name]} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </Card>
  );
};

export const HoursMixPie = ({ hoursMix = [] }) => (
  <Card className="p-4">
    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
      Hours Mix
    </p>
    <ResponsiveContainer width="100%" height={200}>
      {hoursMix.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-[var(--color-text-muted)] opacity-60">
          No hours logged
        </div>
      ) : (
        <PieChart>
          <Pie data={hoursMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
            {hoursMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}h`, 'Hours']} />
        </PieChart>
      )}
    </ResponsiveContainer>
  </Card>
);

export const PriorityBarChart = ({ byPriority }) => {
  const data = [
    { name: 'Critical', count: byPriority?.critical || 0 },
    { name: 'High', count: byPriority?.high || 0 },
    { name: 'Medium', count: byPriority?.medium || 0 },
    { name: 'Low', count: byPriority?.low || 0 },
  ].filter((d) => d.count > 0);

  return (
    <Card className="p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
        Tasks by Priority
      </p>
      <ResponsiveContainer width="100%" height={200}>
        {data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-xs text-[var(--color-text-muted)] opacity-60">
            No tasks in range
          </div>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
            <Tooltip formatter={(v) => [`${v} tasks`, 'Count']} />
            <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </Card>
  );
};

export const HoursByMemberChart = ({ byMember }) => (
  <DivisionBarChart
    title="Hours by Member"
    data={(byMember || []).map((m) => ({ name: m.name, hours: m.hours }))}
  />
);
