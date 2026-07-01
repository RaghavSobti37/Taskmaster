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

  const { chartData, type, loading } = useMemo(() => {
    const days = timeframe === '1d' ? 1 : timeframe === '7d' ? 7 : 30;
    const now = new Date();

    if (componentId === 'campaign-metrics' && mailStats) {
      return {
        type: 'bar',
        loading: mailStatsLoading,
        chartData: [
          { label: 'Sent', value: mailStats.totalSent || 0 },
          { label: 'Opens', value: mailStats.totalOpened || 0 },
          { label: 'Clicks', value: mailStats.totalClicks || 0 },
        ],
      };
    }

    if (componentId === 'dept-stats' && deptStats?.metrics) {
      const m = deptStats.metrics;
      return {
        type: 'bar',
        loading: deptStatsLoading,
        chartData: [
          { label: 'Tasks', value: m.completionRate || 0 },
          { label: 'Converted', value: m.convertedLeads || 0 },
          { label: 'Focus', value: m.focusAvgHours ?? m.focusHours ?? 0 },
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
          ? 'px-3 py-2 flex flex-col flex-1 min-h-0 justify-center'
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
      <ChartSurface
        className={isBarWidget ? 'w-full shrink-0' : 'flex-1 min-h-0'}
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
