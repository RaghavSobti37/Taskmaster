import React, { useMemo, useState } from 'react';
import { Radio } from 'lucide-react';
import { curveMonotoneX } from '@visx/curve';
import { DashboardWidgetShell, TimeframeFilter, InfoButton, MetricCard, QueryErrorBanner, getQueryErrorMessage } from '../ui';
import { ChartSurface } from '../ui/charts';
import { BklitAreaSeriesChart } from '../charts/bklitInsightsCharts';
import { useTaskActivitySeries } from '../../hooks/queries/dashboard';
import { formatTimeframeLabel } from '../../utils/displayLabels';
import { chartTicksForTimeframe, mapDashboardSeriesToChart } from '../../utils/chartTimeSeries';

function ActivitySparkline({ points = [] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const width = 72;
  const height = 22;
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - (v / max) * (height - 2) - 1;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-[var(--color-brand-teal)]/80" aria-hidden>
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

export default function TeamActivityCard() {
  const [timeframe, setTimeframe] = useState('7d');
  const { data, isLoading, isError, error, refetch } = useTaskActivitySeries(timeframe);

  const chartData = useMemo(
    () => mapDashboardSeriesToChart(data?.series),
    [data?.series],
  );

  const summary = useMemo(() => {
    if (!chartData.length) return null;
    const values = chartData.map((d) => d.value);
    const latest = values[values.length - 1] ?? 0;
    const prior = values.slice(0, -1);
    const priorAvg = prior.length ? prior.reduce((s, v) => s + v, 0) / prior.length : 0;
    const delta = Math.round(latest - priorAvg);
    const deltaPercent = priorAvg ? Math.round((delta / priorAvg) * 100) : (latest ? 100 : 0);
    const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    return { latest, delta, deltaPercent, trend, values };
  }, [chartData]);

  const titleContent = (
    <>
      Task Activity
      <InfoButton text="Team-wide task timeline events per day — messages, status changes, assignments, and updates." />
    </>
  );

  return (
    <DashboardWidgetShell
      className="h-full overflow-hidden"
      bodyClassName="p-4 flex flex-col flex-1 min-h-0 gap-3"
      title={titleContent}
      icon={Radio}
      actions={<TimeframeFilter value={timeframe} onChange={setTimeframe} />}
    >
      {isError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(error, 'Failed to load task activity')}
          onRetry={() => refetch()}
          className="shrink-0"
        />
      )}
      {!isLoading && summary && (
        <MetricCard
          label="Events (latest day)"
          value={summary.latest}
          delta={summary.delta}
          deltaPercent={summary.deltaPercent}
          trend={summary.trend}
          variant="mint"
          sparkline={<ActivitySparkline points={summary.values} />}
          className="shrink-0"
        />
      )}
      <ChartSurface className="flex-1 min-h-0" height={220}>
        <BklitAreaSeriesChart
          curve={curveMonotoneX}
          dataKey="value"
          emptyLabel={`No task activity for the last ${formatTimeframeLabel(timeframe)}`}
          fill="var(--color-brand-teal)"
          fillOpacity={0.28}
          height={220}
          loading={isLoading}
          numTicks={chartTicksForTimeframe(timeframe)}
          series={chartData}
          tickMode="domain"
          xKey="date"
        />
      </ChartSurface>
    </DashboardWidgetShell>
  );
}
