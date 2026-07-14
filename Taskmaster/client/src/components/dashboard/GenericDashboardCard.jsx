import React, { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { DashboardWidgetShell, TimeframeFilter, InfoButton, QueryErrorBanner, getQueryErrorMessage } from '../ui';
import { ChartSurface } from '../ui/charts';
import { BklitAreaSeriesChart, BklitCategoryBarChart } from '../charts/bklitInsightsCharts';
import { COMPONENT_REGISTRY } from '../../lib/componentRegistry';
import { useDashboardTasks, useMailStats, useDepartmentStats } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { formatTimeframeLabel } from '../../utils/displayLabels';
import { chartTicksForTimeframe } from '../../utils/chartTimeSeries';

const COMPACT_BAR_HEIGHT = 140;

function campaignClicks(mailStats) {
  return Number(mailStats?.totalClicked ?? mailStats?.totalClicks ?? 0) || 0;
}

const GenericDashboardCard = React.memo(function GenericDashboardCard({ componentId, tasks: tasksProp }) {
  const [timeframe, setTimeframe] = useState('7d');
  const { user } = useAuth();

  const needsTaskFallback = !tasksProp
    && ['booked-calls', 'followups-today', 'artist-calendar'].includes(componentId);
  const { data: tasksFromQuery = [] } = useDashboardTasks(user?._id, needsTaskFallback);
  const tasks = tasksProp ?? tasksFromQuery;
  const {
    data: mailStats,
    isLoading: mailStatsLoading,
    isError: mailStatsError,
    error: mailStatsErr,
    refetch: refetchMailStats,
  } = useMailStats(componentId === 'campaign-metrics', { timeframe });
  const {
    data: deptStats,
    isLoading: deptStatsLoading,
    isError: deptStatsError,
    error: deptStatsErr,
    refetch: refetchDeptStats,
  } = useDepartmentStats(timeframe, componentId === 'dept-stats');

  const queryError =
    componentId === 'campaign-metrics' && mailStatsError ? mailStatsErr
      : componentId === 'dept-stats' && deptStatsError ? deptStatsErr
        : null;
  const handleQueryRetry = () => {
    if (componentId === 'campaign-metrics' && mailStatsError) refetchMailStats();
    else if (componentId === 'dept-stats' && deptStatsError) refetchDeptStats();
  };

  const meta = COMPONENT_REGISTRY[componentId];

  const { chartData, type, loading, metricTiles } = useMemo(() => {
    const days = timeframe === '1d' ? 1 : timeframe === '7d' ? 7 : 30;
    const now = new Date();

    if (componentId === 'campaign-metrics') {
      const sent = Number(mailStats?.totalSent || 0) || 0;
      const opens = Number(mailStats?.totalOpened || 0) || 0;
      const clicks = campaignClicks(mailStats);
      return {
        type: 'bar',
        loading: mailStatsLoading,
        metricTiles: [
          { label: 'Sent', value: sent, hint: 'emails' },
          { label: 'Opens', value: opens, hint: 'unique opens' },
          { label: 'Clicks', value: clicks, hint: 'link clicks' },
        ],
        chartData: [
          { label: 'Sent', value: sent },
          { label: 'Opens', value: opens },
          { label: 'Clicks', value: clicks },
        ],
      };
    }

    if (componentId === 'dept-stats') {
      const m = deptStats?.metrics || {};
      const completion = Number(m.completionRate || 0) || 0;
      const converted = Number(m.convertedLeads || 0) || 0;
      const focus = Number(m.focusAvgHours ?? m.focusHours ?? 0) || 0;
      return {
        type: 'bar',
        loading: deptStatsLoading,
        metricTiles: [
          { label: 'Tasks', value: `${completion}%`, hint: 'completion rate' },
          { label: 'Converted', value: converted, hint: 'leads' },
          { label: 'Focus', value: `${focus}h`, hint: 'avg / day' },
        ],
        chartData: [
          { label: 'Tasks %', value: completion },
          { label: 'Converted', value: converted },
          { label: 'Focus h', value: focus },
        ],
      };
    }

    const dataMap = new Map();
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(now, i);
      dataMap.set(format(d, 'yyyy-MM-dd'), 0);
    }
    tasks.forEach((t) => {
      const day = t.scheduleDate || t.dueDate || t.createdAt;
      if (!day) return;
      const key = format(new Date(day), 'yyyy-MM-dd');
      if (dataMap.has(key)) {
        dataMap.set(key, dataMap.get(key) + 1);
      }
    });

    return {
      type: 'area',
      loading: false,
      metricTiles: null,
      chartData: Array.from(dataMap.entries()).map(([date, value]) => ({
        date,
        value,
      })),
    };
  }, [tasks, timeframe, componentId, mailStats, mailStatsLoading, deptStats, deptStatsLoading]);

  const hasData = chartData.some((d) => d.value > 0);
  const emptyLabel = `No data to display for the last ${formatTimeframeLabel(timeframe)}`;

  const titleContent = (
    <>
      {meta?.icon || '📊'} {meta?.label || componentId}
      {componentId === 'dept-stats' && (
        <InfoButton text="Bars use different units: Tasks = completion %, Converted = lead count, Focus = avg focus hours per day in the selected window." />
      )}
    </>
  );

  const isBarWidget = componentId === 'campaign-metrics' || componentId === 'dept-stats';

  return (
    <DashboardWidgetShell
      className="h-full overflow-hidden"
      bodyClassName={
        isBarWidget
          ? 'px-3 py-2 flex flex-col flex-1 min-h-0'
          : 'p-4 flex flex-col flex-1 min-h-0'
      }
      title={titleContent}
      actions={<TimeframeFilter value={timeframe} onChange={setTimeframe} />}
    >
      {queryError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(queryError, 'Failed to load widget data')}
          onRetry={handleQueryRetry}
          className="mb-3"
        />
      )}
      {metricTiles && (
        <div className="grid grid-cols-3 gap-2 mb-2 shrink-0">
          {metricTiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-md border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] px-2 py-1.5 min-w-0"
            >
              <p className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] truncate">{tile.label}</p>
              <p className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)] leading-tight">{tile.value}</p>
              <p className="text-[9px] text-[var(--color-text-muted)] truncate">{tile.hint}</p>
            </div>
          ))}
        </div>
      )}
      <ChartSurface
        className={isBarWidget ? 'w-full flex-1 min-h-0' : 'flex-1 min-h-0'}
        height={isBarWidget ? COMPACT_BAR_HEIGHT : 200}
      >
        {type === 'bar' ? (
          <BklitCategoryBarChart
            emptyLabel={emptyLabel}
            fillHeight
            height={COMPACT_BAR_HEIGHT}
            labelKey="label"
            loading={loading}
            series={hasData ? chartData : []}
            valueKey="value"
          />
        ) : (
          <BklitAreaSeriesChart
            dataKey="value"
            emptyLabel={emptyLabel}
            fill="var(--color-action-primary)"
            height={200}
            loading={loading}
            series={hasData ? chartData : []}
            tickMode="domain"
            numTicks={chartTicksForTimeframe(timeframe)}
            xKey="date"
          />
        )}
      </ChartSurface>
    </DashboardWidgetShell>
  );
});

export default GenericDashboardCard;
