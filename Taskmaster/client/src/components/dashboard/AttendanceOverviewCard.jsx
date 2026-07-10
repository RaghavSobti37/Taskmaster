import React, { useState, useMemo } from 'react';
import { Users } from 'lucide-react';
import { DashboardWidgetShell, TimeframeFilter, InfoButton, MetricCard } from '../ui';
import { ChartSurface } from '../ui/charts';
import { BklitMultiLineChart } from '../charts/bklitInsightsCharts';
import { useAttendanceOverview } from '../../hooks/queries/dashboard';
import { formatTimeframeLabel } from '../../utils/displayLabels';
import { chartTicksForTimeframe, mapDashboardSeriesWithDate } from '../../utils/chartTimeSeries';

const SERIES = [
  { key: 'marked', name: 'Marked attendance', stroke: '#3b82f6' },
  { key: 'present', name: 'Present', stroke: '#10b981' },
  { key: 'halfDay', name: 'Half day', stroke: '#eab308' },
  { key: 'leave', name: 'Leave', stroke: '#ef4444' },
];

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

  const chartData = useMemo(
    () => mapDashboardSeriesWithDate(data?.series),
    [data?.series],
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
      bodyClassName="p-4 flex flex-col flex-1 min-h-0 gap-3"
      title={titleContent}
      icon={Users}
      actions={<TimeframeFilter value={timeframe} onChange={setTimeframe} />}
    >
      {!isLoading && markedMetric && (
        <MetricCard
          label="Marked (latest day)"
          value={markedMetric.latest}
          delta={markedMetric.delta}
          deltaPercent={markedMetric.deltaPercent}
          trend={markedMetric.trend}
          variant="mint"
          sparkline={<MarkedSparkline points={markedMetric.markedSeries} />}
          className="shrink-0"
        />
      )}
      <ChartSurface className="flex-1" height={200}>
        <BklitMultiLineChart
          emptyLabel={`No attendance marks for the last ${formatTimeframeLabel(timeframe)}`}
          height={200}
          lines={SERIES}
          loading={isLoading}
          numTicks={chartTicksForTimeframe(timeframe)}
          series={chartData}
        />
      </ChartSurface>
    </DashboardWidgetShell>
  );
});

export default AttendanceOverviewCard;
