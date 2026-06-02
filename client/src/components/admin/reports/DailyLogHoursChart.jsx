import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Card, Badge } from '../../ui';

const LogLineChart = ({ title, data, dataKey, stroke, badge, formatValue, valueLabel }) => (
  <Card className="p-4 h-full flex flex-col">
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
        {title}
      </p>
      {badge != null && (
        <Badge variant="info">{badge}</Badge>
      )}
    </div>
    <div className="flex-1 min-h-[200px]">
      {data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-[var(--color-text-muted)] opacity-60">
          No data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} allowDecimals={dataKey === 'hours'} />
            <Tooltip
              formatter={(value) => [formatValue(value), valueLabel]}
              labelFormatter={(label) => {
                const row = data.find((d) => d.label === label);
                return row?.date ? format(parseISO(row.date), 'MMM d, yyyy') : label;
              }}
            />
            <Line type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={2} dot={false} name={valueLabel} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  </Card>
);

const DailyLogHoursChart = ({ byDay = [], totalEntries = 0 }) => {
  const chartData = useMemo(
    () => byDay.map((d) => ({
      ...d,
      count: d.count ?? d.logCount ?? 0,
      hours: Number(d.hours || 0),
      label: d.date?.slice(5) || d.date,
    })),
    [byDay]
  );

  const totalLogs = totalEntries || chartData.reduce((s, d) => s + (d.count || 0), 0);
  const totalHours = chartData.reduce((s, d) => s + (d.hours || 0), 0);

  return (
    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
      <LogLineChart
        title="Daily Log Hours"
        data={chartData}
        dataKey="hours"
        stroke="#6366f1"
        badge={`${totalHours.toFixed(1)}h total`}
        formatValue={(v) => `${Number(v).toFixed(1)}h`}
        valueLabel="Hours"
      />
      <LogLineChart
        title="Logs per Day"
        data={chartData}
        dataKey="count"
        stroke="#f59e0b"
        badge={`${totalLogs} logs`}
        formatValue={(v) => String(Math.round(Number(v)))}
        valueLabel="Logs"
      />
    </div>
  );
};

export default DailyLogHoursChart;
