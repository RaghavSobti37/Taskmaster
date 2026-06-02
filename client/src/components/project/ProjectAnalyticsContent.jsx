import React from 'react';
import { useProjectAnalytics } from '../../hooks/queries/projects';
import { Card, DataLoading, Badge, UserLabel } from '../ui';
import ProjectReportRangeControls from './ProjectReportRangeControls';
import { useProjectReportRangeState } from '../../hooks/useProjectReportRangeState';
import DailyLogHoursChart from '../admin/reports/DailyLogHoursChart';
import DailyLogsTable from '../admin/DailyLogsTable';
import {
  HoursByMemberChart,
  TaskStatusPie,
  HoursMixPie,
  PriorityBarChart,
} from './ProjectAnalyticsCharts';

const PRIORITY_KEYS = ['critical', 'high', 'medium', 'low'];
const PRIORITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

const taskTotal = (m) => PRIORITY_KEYS.reduce((s, k) => s + (m.tasksByPriority?.[k] || 0), 0);

const MemberBreakdownTable = ({ members = [] }) => (
  <Card className="p-4 overflow-x-auto">
    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
      Member breakdown
    </p>
    {members.length === 0 ? (
      <p className="text-xs text-[var(--color-text-muted)] opacity-60">No member activity in this period.</p>
    ) : (
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)]">
            <th className="pb-2 pr-3">Member</th>
            <th className="pb-2 pr-3">Total h</th>
            <th className="pb-2 pr-3">Manual</th>
            <th className="pb-2 pr-3">Task</th>
            <th className="pb-2 pr-3">Logs</th>
            <th className="pb-2">Tasks done</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} className="border-b border-[var(--color-bg-border)]/50">
              <td className="py-2 pr-3">
                <UserLabel user={m} size="xs" nameClassName="font-bold text-xs" />
              </td>
              <td className="py-2 pr-3">{m.hours?.toFixed(1)}</td>
              <td className="py-2 pr-3">{m.manualHours?.toFixed(1)}</td>
              <td className="py-2 pr-3">{m.taskHours?.toFixed(1)}</td>
              <td className="py-2 pr-3">{m.logCount}</td>
              <td className="py-2">{m.tasksCompleted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </Card>
);

const MemberTasksByPriorityTable = ({ members = [] }) => {
  const rows = members.filter((m) => taskTotal(m) > 0);
  return (
    <Card className="p-4 overflow-x-auto">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
        Tasks by member &amp; priority
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] opacity-60">
          No assigned tasks in this period.
        </p>
      ) : (
        <table className="w-full text-left text-xs">
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
                  <td key={k} className="py-2 pr-3 text-center font-mono">
                    {m.tasksByPriority?.[k] || 0}
                  </td>
                ))}
                <td className="py-2 text-center font-bold">{taskTotal(m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
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

  const { data: report, isLoading, error } = useProjectAnalytics(projectId, queryParams, queryEnabled);

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

      {isLoading && <DataLoading message="Loading analytics..." />}
      {error && (
        <p className="text-sm text-red-500">
          {error.response?.data?.error || error.message || 'Failed to load analytics.'}
        </p>
      )}

      {report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-4">
              <p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Total Hours</p>
              <p className="text-3xl font-black mt-1">{report.summary.totalHours.toFixed(1)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Manual Logs</p>
              <p className="text-3xl font-black mt-1">{report.summary.manualLogHours.toFixed(1)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Task Hours</p>
              <p className="text-3xl font-black mt-1">{report.summary.taskCompletionHours.toFixed(1)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Planned</p>
              <p className="text-3xl font-black mt-1">{report.summary.plannedHours.toFixed(1)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Daily Logs</p>
              <p className="text-3xl font-black mt-1">{report.summary.logEntries}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Tasks Done</p>
              <p className="text-3xl font-black mt-1">{report.summary.tasksCompleted}</p>
              <p className="text-[9px] text-[var(--color-text-muted)] mt-1">
                of {report.summary.tasksTotal} active in range
              </p>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <DailyLogHoursChart
              byDay={report.byDay}
              totalEntries={report.summary.logEntries}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <HoursMixPie hoursMix={report.hoursMix} />
            <TaskStatusPie byStatus={report.byStatus} />
            <PriorityBarChart byPriority={report.byPriority} />
            <HoursByMemberChart byMember={report.byMember} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <MemberTasksByPriorityTable members={report.byMember} />
            <MemberBreakdownTable members={report.byMember} />
          </div>

          <Card className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
              Recent daily logs
            </p>
            <DailyLogsTable entries={report.recentLogs || []} showMember />
          </Card>
        </>
      )}
    </div>
  );
};

export default ProjectAnalyticsContent;
