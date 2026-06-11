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
import { DashboardWidgetShell, TimeframeFilter, InfoButton, Spinner, MetricCard } from '../ui';
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

function MarkedSparkline({ points = [] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points);
  const span = max - min || 1;
  const width = 72;
  const height = 22;
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((v - min) / span) * (height - 2) - 1;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-emerald-400/80" aria-hidden>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.join(' ')}
      />
    </svg>
  );
}

const AttendanceOverviewCard = React.memo(function AttendanceOverviewCard() {
  const [timeframe, setTimeframe] = useState('7d');
  const { data, isLoading } = useAttendanceOverview(timeframe);

  const chartData = useMemo(() => data?.series || [], [data?.series]);
  const hasData = chartData.some(
    (d) => d.marked > 0 || d.present > 0 || d.halfDay > 0 || d.leave > 0
  );

  const markedMetric = useMemo(() => {
    if (!chartData.length) return null;
    const markedSeries = chartData.map((d) => d.marked || 0);
    const latest = markedSeries[markedSeries.length - 1] ?? 0;
    const prior = markedSeries.slice(0, -1);
    const priorAvg = prior.length ? prior.reduce((s, v) => s + v, 0) / prior.length : 0;
    const delta = Math.round(latest - priorAvg);
    const deltaPercent = priorAvg ? Math.round((delta / priorAvg) * 100) : (latest ? 100 : 0);
    const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    return { latest, delta, deltaPercent, trend, markedSeries };
  }, [chartData]);

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
      {!isLoading && markedMetric && hasData && (
        <MetricCard
          label="Marked (latest day)"
          value={markedMetric.latest}
          delta={markedMetric.delta}
          deltaPercent={markedMetric.deltaPercent}
          trend={markedMetric.trend}
          periodLabel={formatTimeframeLabel(timeframe)}
          variant="mint"
          sparkline={<MarkedSparkline points={markedMetric.markedSeries} />}
          className="mb-3 shrink-0"
        />
      )}
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
});

export default AttendanceOverviewCard;
