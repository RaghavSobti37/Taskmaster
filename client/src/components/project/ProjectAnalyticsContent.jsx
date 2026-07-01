import React from 'react';
import { Clock, CheckCircle2, ListTodo, Timer, Wallet, IndianRupee, PiggyBank, TrendingUp } from 'lucide-react';
import { useProjectAnalytics } from '../../hooks/queries/projects';
import { DataLoading, Badge, UserLabel, DataOverviewSection, Card } from '../ui';
import ProjectReportRangeControls from './ProjectReportRangeControls';
import { useProjectReportRangeState } from '../../hooks/useProjectReportRangeState';
import DailyLogHoursChart from '../admin/reports/DailyLogHoursChart';
import DailyLogsTable from '../admin/DailyLogsTable';
import {
  TaskStatusPie,
  HoursMixPie,
  PriorityBarChart,
} from './ProjectAnalyticsCharts';
import ProjectFinanceSpendBreakdown from './ProjectFinanceSpendBreakdown';
import { formatProjectInr } from './ProjectAnalyticsTableBits';

const PRIORITY_KEYS = ['critical', 'high', 'medium', 'low'];
const PRIORITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

const taskTotal = (m) => PRIORITY_KEYS.reduce((s, k) => s + (m.tasksByPriority?.[k] || 0), 0);

const MemberBreakdownTable = ({ members = [] }) => (
  <div>
    <p className="tm-widget-label mb-3">Member breakdown</p>
    <div className="overflow-x-auto">
    {members.length === 0 ? (
      <p className="text-xs text-[var(--color-text-muted)] opacity-60">No member activity in this period.</p>
    ) : (
      <table className="w-full table-fixed text-left text-xs border-collapse">
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead>
          <tr className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)]">
            <th className="pb-2 pr-3 font-semibold">Member</th>
            <th className="pb-2 pr-3 text-right font-semibold">Total h</th>
            <th className="pb-2 pr-3 text-right font-semibold">Manual</th>
            <th className="pb-2 pr-3 text-right font-semibold">Task</th>
            <th className="pb-2 pr-3 text-right font-semibold">Logs</th>
            <th className="pb-2 text-right font-semibold">Tasks done</th>
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
  </div>
);

const MemberTasksByPriorityTable = ({ members = [] }) => {
  const rows = members.filter((m) => taskTotal(m) > 0);
  return (
    <div>
      <p className="tm-widget-label mb-3">Tasks by member &amp; priority</p>
      <div className="overflow-x-auto">
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] opacity-60">
          No assigned tasks in this period.
        </p>
      ) : (
        <table className="w-full table-fixed text-left text-xs border-collapse">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)]">
              <th className="pb-2 pr-3 font-semibold">Member</th>
              {PRIORITY_KEYS.map((k) => (
                <th key={k} className="pb-2 pr-3 text-center font-semibold">{PRIORITY_LABELS[k]}</th>
              ))}
              <th className="pb-2 text-center font-semibold">Total</th>
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

      {isLoading && !report && <DataLoading />}
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

          <DataOverviewSection
            stats={[
              {
                id: 'budget',
                label: 'Budget',
                value: formatProjectInr(report.summary.budget),
                icon: Wallet,
                variant: 'slate',
                info: 'Sum of budget-category finance docs (all-time).',
              },
              {
                id: 'spent',
                label: 'Spent',
                value: formatProjectInr(report.summary.spentInRange || report.summary.spentTotal),
                subValue: report.summary.spentInRange !== report.summary.spentTotal
                  ? `${formatProjectInr(report.summary.spentTotal)} all-time`
                  : 'in range',
                icon: IndianRupee,
                variant: 'apricot',
              },
              {
                id: 'remaining',
                label: 'Remaining',
                value: formatProjectInr(report.summary.remaining),
                icon: PiggyBank,
                variant: 'mint',
              },
              {
                id: 'revenue',
                label: 'Revenue',
                value: formatProjectInr(report.summary.revenueInRange),
                icon: TrendingUp,
                variant: 'info',
                subValue: 'in range',
              },
            ]}
          />

          <div className="border-t border-[var(--color-bg-border)] pt-6">
            <p className="tm-widget-label mb-3">Spend by category</p>
            <ProjectFinanceSpendBreakdown
              finance={report.finance}
              rangeLabel={subtitle ? `In ${subtitle}` : 'In range'}
            />
          </div>

          <DailyLogHoursChart
            byDay={report.byDay}
            totalEntries={report.summary.logEntries}
          />

          <div className="space-y-4 border-t border-[var(--color-bg-border)] pt-6">
            <p className="tm-widget-label">Task &amp; hours breakdown</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <Card className="p-4 overflow-hidden min-h-[280px]">
                <HoursMixPie hoursMix={report.hoursMix} />
              </Card>
              <Card className="p-4 overflow-hidden min-h-[280px]">
                <TaskStatusPie byStatus={report.byStatus} />
              </Card>
              <Card className="p-4 overflow-hidden min-h-[280px] md:col-span-2 xl:col-span-1">
                <PriorityBarChart byPriority={report.byPriority} />
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 border-t border-[var(--color-bg-border)] pt-8">
            <Card className="p-4 overflow-hidden">
              <MemberTasksByPriorityTable members={report.byMember} />
            </Card>
            <Card className="p-4 overflow-hidden">
              <MemberBreakdownTable members={report.byMember} />
            </Card>
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
