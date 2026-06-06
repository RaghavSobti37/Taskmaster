import React, { useState, useMemo } from 'react';
import { Users } from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { DashboardWidgetShell, TimeframeFilter, InfoButton, Spinner } from '../ui';
import { ChartSurface, CHART_MUTED } from '../ui/charts';;
import { useAttendanceOverview } from '../../hooks/queries/dashboard';
import { formatTimeframeLabel } from '../../utils/displayLabels';

const SERIES = [
  { key: 'marked', name: 'Marked attendance', color: '#3b82f6' },
  { key: 'present', name: 'Present', color: '#10b981' },
  { key: 'halfDay', name: 'Half day', color: '#eab308' },
  { key: 'leave', name: 'Leave', color: '#ef4444' },
];

const AttendanceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border border-[var(--color-bg-border)] px-3 py-2 text-xs shadow-lg"
      style={CHART_MUTED.tooltip}
    >
      <p className="font-bold text-[var(--color-text-primary)] mb-1.5">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="tabular-nums" style={{ color: entry.color }}>
          {entry.name}: {entry.value} {entry.value === 1 ? 'person' : 'people'}
        </p>
      ))}
    </div>
  );
};

function AttendanceOverviewCard() {
  const [timeframe, setTimeframe] = useState('7d');
  const { data, isLoading } = useAttendanceOverview(timeframe);

  const chartData = useMemo(() => data?.series || [], [data?.series]);
  const hasData = chartData.some(
    (d) => d.marked > 0 || d.present > 0 || d.halfDay > 0 || d.leave > 0
  );

  const titleContent = (
    <>
      👥 Attendance Overview
      <InfoButton text="Unique people per day: blue = checked in/out, green = full present, yellow = half day, red = leave (no punch)." />
    </>
  );

  return (
    <DashboardWidgetShell
      className="h-full overflow-hidden"
      bodyClassName="p-4 flex flex-col flex-1 min-h-0"
      title={titleContent}
      icon={Users}
      actions={<TimeframeFilter value={timeframe} onChange={setTimeframe} />}
    >
      <ChartSurface className="flex-1" height={200}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full w-full py-8">
            <Spinner size="md" />
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center opacity-40 h-full w-full py-8">
            <p className="text-xs text-[var(--color-text-secondary)] italic">
              No attendance marks for the last {formatTimeframeLabel(timeframe)}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...CHART_MUTED.grid} vertical={false} />
              <XAxis dataKey="label" tick={CHART_MUTED.axis} axisLine={false} tickLine={false} />
              <YAxis
                tick={CHART_MUTED.axis}
                axisLine={false}
                tickLine={false}
                width={32}
                allowDecimals={false}
              />
              <Tooltip content={<AttendanceTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                iconType="circle"
                iconSize={8}
              />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: s.color }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartSurface>
    </DashboardWidgetShell>
  );
}

export default AttendanceOverviewCard;
