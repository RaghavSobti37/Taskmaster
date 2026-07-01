import { formatDisplayDateShort } from '../../utils/dateDisplay';
import React, { useState, useMemo } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { DashboardWidgetShell, TimeframeFilter, InfoButton, QueryErrorBanner, getQueryErrorMessage } from '../ui';
import { ChartSurface } from '../ui/charts';
import { BklitAreaSeriesChart, BklitCategoryBarChart } from '../charts/bklitInsightsCharts';
import { COMPONENT_REGISTRY } from '../../lib/componentRegistry';
import { useDashboardTasks, useMailStats, useActivityGrid, useDepartmentStats } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { formatTimeframeLabel } from '../../utils/displayLabels';

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
  } = useMailStats(componentId === 'campaign-metrics');
  const {
    data: activityData,
    isLoading: activityLoading,
    isError: activityError,
    error: activityErr,
    refetch: refetchActivity,
  } = useActivityGrid(componentId === 'team-activity');
  const {
    data: deptStats,
    isLoading: deptStatsLoading,
    isError: deptStatsError,
    error: deptStatsErr,
    refetch: refetchDeptStats,
  } = useDepartmentStats(timeframe, componentId === 'dept-stats');

  const queryError =
    componentId === 'campaign-metrics' && mailStatsError ? mailStatsErr
      : componentId === 'team-activity' && activityError ? activityErr
        : componentId === 'dept-stats' && deptStatsError ? deptStatsErr
          : null;
  const handleQueryRetry = () => {
    if (componentId === 'campaign-metrics' && mailStatsError) refetchMailStats();
    else if (componentId === 'team-activity' && activityError) refetchActivity();
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

    if (componentId === 'team-activity' && activityData?.length) {
      const recent = activityData.slice(-days);
      return {
        type: 'area',
        loading: activityLoading,
        chartData: recent.map((d) => {
          const rawDate = d.date || d._id || d.label;
          let label = String(rawDate).slice(5) || 'Unknown';
          try {
            if (rawDate) label = formatDisplayDateShort(parseISO(String(rawDate)));
          } catch {
            // fallback gracefully
          }
          return { label, value: d.count || d.value || 0, sortKey: String(rawDate) };
        })
          .sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || ''))
          .map(({ label, value }) => ({ label, value })),
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
      dataMap.set(formatDisplayDateShort(d), 0);
    }
    tasks.forEach((t) => {
      const day = t.scheduleDate || t.dueDate || t.createdAt;
      if (!day) return;
      const fmt = formatDisplayDateShort(new Date(day));
      if (dataMap.has(fmt)) {
        dataMap.set(fmt, dataMap.get(fmt) + 1);
      }
    });

    return {
      type: 'area',
      loading: false,
      chartData: Array.from(dataMap.entries()).map(([label, value]) => ({ label, value })),
    };
  }, [tasks, timeframe, componentId, mailStats, mailStatsLoading, activityData, activityLoading, deptStats, deptStatsLoading]);

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

  return (
    <DashboardWidgetShell
      className="h-full overflow-hidden"
      bodyClassName="p-4 flex flex-col flex-1 min-h-0"
      title={titleContent}
      actions={
        componentId !== 'campaign-metrics' ? (
          <TimeframeFilter value={timeframe} onChange={setTimeframe} />
        ) : null
      }
    >
      {queryError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(queryError, 'Failed to load widget data')}
          onRetry={handleQueryRetry}
          className="mb-3"
        />
      )}
      <ChartSurface className="flex-1" height={200}>
        {type === 'bar' ? (
          <BklitCategoryBarChart
            emptyLabel={emptyLabel}
            height={200}
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
            xKey="label"
          />
        )}
      </ChartSurface>
    </DashboardWidgetShell>
  );
});

export default GenericDashboardCard;
