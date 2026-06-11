import React, { useState, useMemo } from 'react';
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { DashboardWidgetShell, TimeframeFilter, InfoButton, Spinner, QueryErrorBanner, getQueryErrorMessage } from '../ui';
import { ChartSurface, CHART_MUTED } from '../ui/charts';;
import { COMPONENT_REGISTRY } from '../../lib/componentRegistry';
import { useDashboardTasks, useMailStats, useActivityGrid, useDepartmentStats } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { formatTimeframeLabel } from '../../utils/displayLabels';

const formatBarMetric = (value, _name, item) => {
  const metric = item?.payload?.label || 'Count';
  if (metric === 'Tasks') return [`${value}%`, 'Completion Rate'];
  if (metric === 'Converted') return [String(value), 'Converted'];
  if (metric === 'Focus') return [`${value}h`, 'Avg Focus / Day'];
  return [String(value), metric];
};

const GenericDashboardCard = React.memo(function GenericDashboardCard({ componentId }) {
  const [timeframe, setTimeframe] = useState('7d');
  const { user } = useAuth();

  const { data: tasks = [] } = useDashboardTasks(user?._id);
  const {
    data: mailStats,
    isError: mailStatsError,
    error: mailStatsErr,
    refetch: refetchMailStats,
  } = useMailStats(componentId === 'campaign-metrics');
  const {
    data: activityData,
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

  const { chartData, type, seriesName, tooltipFormatter } = useMemo(() => {
    const days = timeframe === '1d' ? 1 : timeframe === '7d' ? 7 : 30;
    const now = new Date();

    if (componentId === 'campaign-metrics' && mailStats) {
      return {
        type: 'bar',
        chartData: [
          { label: 'Sent', value: mailStats.totalSent || 0 },
          { label: 'Opens', value: mailStats.totalOpened || 0 },
          { label: 'Clicks', value: mailStats.totalClicks || 0 }
        ],
        tooltipFormatter: formatBarMetric,
      };
    }

    if (componentId === 'team-activity' && activityData?.length) {
      const recent = activityData.slice(-days);
      return {
        type: 'area',
        seriesName: 'Tasks',
        chartData: recent.map(d => {
          const rawDate = d.date || d._id || d.label;
          let label = String(rawDate).slice(5) || 'Unknown';
          try {
            if (rawDate) label = format(parseISO(String(rawDate)), 'MMM dd');
          } catch (e) {
            // fallback gracefully
          }
          return { label, value: d.count || d.value || 0, sortKey: String(rawDate) };
        })
          .sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || ''))
          .map(({ label, value }) => ({ label, value })),
        tooltipFormatter: (value) => [String(value), 'Tasks'],
      };
    }

    if (componentId === 'dept-stats' && deptStats?.metrics) {
      const m = deptStats.metrics;
      return {
        type: 'bar',
        chartData: [
          { label: 'Tasks', value: m.completionRate || 0 },
          { label: 'Converted', value: m.convertedLeads || 0 },
          { label: 'Focus', value: m.focusAvgHours ?? m.focusHours ?? 0 },
        ],
        tooltipFormatter: formatBarMetric,
      };
    }

    const dataMap = new Map();
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(now, i);
      dataMap.set(format(d, 'MMM dd'), 0);
    }
    tasks.forEach(t => {
      const day = t.scheduleDate || t.dueDate || t.createdAt;
      if (!day) return;
      const fmt = format(new Date(day), 'MMM dd');
      if (dataMap.has(fmt)) {
        dataMap.set(fmt, dataMap.get(fmt) + 1);
      }
    });

    return {
      type: 'area',
      seriesName: 'Tasks',
      chartData: Array.from(dataMap.entries()).map(([label, value]) => ({ label, value })),
      tooltipFormatter: (value) => [String(value), 'Tasks'],
    };
  }, [tasks, timeframe, componentId, mailStats, activityData, deptStats]);

  const hasData = chartData.some(d => d.value > 0);

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
        {!hasData && componentId === 'dept-stats' && deptStatsLoading ? (
          <div className="flex flex-col items-center justify-center h-full w-full py-8">
            <Spinner size="md" />
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center opacity-40 grayscale h-full w-full py-8">
            <div className="w-full max-w-[200px] space-y-2 mb-3">
              <div className="h-2 w-full bg-[var(--color-text-muted)] rounded-full animate-pulse" />
              <div className="h-2 w-3/4 bg-[var(--color-text-muted)] rounded-full mx-auto animate-pulse" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-1/2 bg-[var(--color-text-muted)] rounded-full mx-auto animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] italic">
              No data to display for the last {formatTimeframeLabel(timeframe)}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            {type === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid {...CHART_MUTED.grid} vertical={false} />
                <XAxis dataKey="label" tick={CHART_MUTED.axis} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_MUTED.axis} axisLine={false} tickLine={false} width={35} />
                <Tooltip
                  contentStyle={CHART_MUTED.tooltip}
                  itemStyle={{ color: 'var(--color-text-primary)' }}
                  cursor={{ fill: 'var(--color-bg-secondary)' }}
                  formatter={tooltipFormatter}
                />
                <Bar dataKey="value" name={seriesName || 'Count'} fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id={`colorValue-${componentId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_MUTED.grid} vertical={false} />
                <XAxis dataKey="label" tick={CHART_MUTED.axis} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_MUTED.axis} axisLine={false} tickLine={false} width={35} />
                <Tooltip
                  contentStyle={CHART_MUTED.tooltip}
                  itemStyle={{ color: 'var(--color-text-primary)' }}
                  formatter={tooltipFormatter}
                />
                <Area type="monotone" dataKey="value" name={seriesName || 'Tasks'} stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill={`url(#colorValue-${componentId})`} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        )}
      </ChartSurface>
    </DashboardWidgetShell>
  );
});

export default GenericDashboardCard;
