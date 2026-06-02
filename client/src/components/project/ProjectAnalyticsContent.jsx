import React from 'react';
import { Clock, CheckCircle2, ListTodo, Timer } from 'lucide-react';
import { useProjectAnalytics } from '../../hooks/queries/projects';
import { DataLoading, Badge, UserLabel, DataOverviewSection } from '../ui';
import ProjectReportRangeControls from './ProjectReportRangeControls';
import { useProjectReportRangeState } from '../../hooks/useProjectReportRangeState';
import DailyLogHoursChart from '../admin/reports/DailyLogHoursChart';
import DailyLogsTable from '../admin/DailyLogsTable';
import {
  TaskStatusPie,
  HoursMixPie,
  PriorityBarChart,
} from './ProjectAnalyticsCharts';

const PRIORITY_KEYS = ['critical', 'high', 'medium', 'low'];
const PRIORITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

const taskTotal = (m) => PRIORITY_KEYS.reduce((s, k) => s + (m.tasksByPriority?.[k] || 0), 0);

const MemberBreakdownTable = ({ members = [] }) => (
  <div className="overflow-x-auto">
    <p className="tm-widget-label mb-3">Member breakdown</p>
    {members.length === 0 ? (
      <p className="text-xs text-[var(--color-text-muted)] opacity-60">No member activity in this period.</p>
    ) : (
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)]">
            <th className="pb-2 pr-3">Member</th>
            <th className="pb-2 pr-3 text-right">Total h</th>
            <th className="pb-2 pr-3 text-right">Manual</th>
            <th className="pb-2 pr-3 text-right">Task</th>
            <th className="pb-2 pr-3 text-right">Logs</th>
            <th className="pb-2 text-right">Tasks done</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} className="border-b border-[var(--color-bg-border)]/50">
              <td className="py-2 pr-3">
                <UserLabel user={m} size="xs" nameClassName="font-bold text-xs" />
              </td>
              <td className="py-2 pr-3 tabular-nums text-right">{m.hours?.toFixed(1)}</td>
              <td className="py-2 pr-3 tabular-nums text-right">{m.manualHours?.toFixed(1)}</td>
              <td className="py-2 pr-3 tabular-nums text-right">{m.taskHours?.toFixed(1)}</td>
              <td className="py-2 pr-3 tabular-nums text-right">{m.logCount}</td>
              <td className="py-2 tabular-nums text-right">{m.tasksCompleted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const MemberTasksByPriorityTable = ({ members = [] }) => {
  const rows = members.filter((m) => taskTotal(m) > 0);
  return (
    <div className="overflow-x-auto">
      <p className="tm-widget-label mb-3">Tasks by member &amp; priority</p>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] opacity-60">
          No assigned tasks in this period.
        </p>
      ) : (
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)]">
              <th className="pb-2 pr-3">Member</th>
              {PRIORITY_KEYS.map((k) => (
                <th key={k} className="pb-2 pr-3 text-center">{PRIORITY_LABELS[k]}</th>
              ))}
              <th className="pb-2 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.userId} className="border-b border-[var(--color-bg-border)]/50">
                <td className="py-2 pr-3">
                  <UserLabel user={m} size="xs" nameClassName="font-bold text-xs" />
                </td>
                {PRIORITY_KEYS.map((k) => (
                  <td key={k} className="py-2 pr-3 text-center tabular-nums">
                    {m.tasksByPriority?.[k] || 0}
                  </td>
                ))}
                <td className="py-2 text-center tabular-nums font-bold">{taskTotal(m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const ProjectAnalyticsContent = ({ projectId, rangeState: externalRangeState }) => {
  const internalRangeState = useProjectReportRangeState();
  const {
    rangeMode,
    setRangeMode,
    timeframe,
    setTimeframe,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    queryParams,
    queryEnabled,
    rangeSubtitle,
  } = externalRangeState || internalRangeState;

  const { data: report, isLoading, isFetching, error } = useProjectAnalytics(projectId, queryParams, queryEnabled);

  const subtitle = rangeSubtitle(report);

  if (!queryEnabled) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">
        Select a valid date range.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!externalRangeState && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            {report?.project?.workspace && (
              <Badge variant="slate" className="w-fit">{report.project.workspace}</Badge>
            )}
            {subtitle && (
              <p className="text-[10px] text-[var(--color-text-muted)]">{subtitle}</p>
            )}
          </div>
          <ProjectReportRangeControls
            rangeMode={rangeMode}
            onRangeModeChange={setRangeMode}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            customStart={customStart}
            customEnd={customEnd}
            onCustomStartChange={setCustomStart}
            onCustomEndChange={setCustomEnd}
          />
        </div>
      )}
      {externalRangeState && report?.project?.workspace && (
        <Badge variant="slate" className="w-fit">{report.project.workspace}</Badge>
      )}

      {isLoading && !report && <DataLoading message="Loading analytics..." />}
      {error && !report && (
        <p className="text-sm text-red-500">
          {error.response?.data?.error || error.message || 'Failed to load analytics.'}
        </p>
      )}

      {report && (
        <div className={isFetching ? 'opacity-70 pointer-events-none transition-opacity' : 'transition-opacity'}>
          <DataOverviewSection
            stats={[
              {
                id: 'total',
                label: 'Total Hours',
                value: report.summary.totalHours.toFixed(1),
                icon: Timer,
                variant: 'info',
              },
              {
                id: 'done',
                label: 'Tasks Done',
                value: report.summary.tasksCompleted,
                subValue: `of ${report.summary.tasksTotal} active in range`,
                icon: CheckCircle2,
                variant: 'mint',
              },
              {
                id: 'logs',
                label: 'Daily Logs',
                value: report.summary.logEntries,
                icon: ListTodo,
                variant: 'slate',
              },
              {
                id: 'planned',
                label: 'Planned',
                value: report.summary.plannedHours.toFixed(1),
                icon: Clock,
                variant: 'apricot',
              },
            ]}
          />

          <DailyLogHoursChart
            byDay={report.byDay}
            totalEntries={report.summary.logEntries}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 border-t border-[var(--color-bg-border)] pt-6">
            <HoursMixPie hoursMix={report.hoursMix} />
            <TaskStatusPie byStatus={report.byStatus} />
            <PriorityBarChart byPriority={report.byPriority} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 border-t border-[var(--color-bg-border)] pt-6">
            <MemberTasksByPriorityTable members={report.byMember} />
            <MemberBreakdownTable members={report.byMember} />
          </div>

          <div className="border-t border-[var(--color-bg-border)] pt-6">
            <p className="tm-widget-label mb-3">Recent daily logs</p>
            <DailyLogsTable entries={report.recentLogs || []} showMember />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectAnalyticsContent;
