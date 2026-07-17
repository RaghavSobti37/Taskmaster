import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, Timer, Wallet, IndianRupee, PiggyBank, TrendingUp,
  NotebookPen, BarChart3, ListChecks, SlidersHorizontal,
} from 'lucide-react';
import { useProjectAnalytics } from '../../hooks/queries/projects';
import { useAuth } from '../../contexts/AuthContext';
import { DataLoading, Badge, UserLabel, Card, Button, QueryErrorBanner, getQueryErrorMessage } from '../ui';
import SelectionFilterPanel, { FilterToolbarButton } from '../ui/SelectionFilterPanel';
import { countActiveFilters } from '../ui/selectionFilterUtils';
import { useProjectReportRangeState } from '../../hooks/useProjectReportRangeState';
import DailyLogHoursChart from '../admin/reports/DailyLogHoursChart';
import DailyLogsTable from '../admin/DailyLogsTable';
import ProjectFinanceDocumentsTable from './ProjectFinanceDocumentsTable';
import ProjectOpenTasksTable from './ProjectOpenTasksTable';
import ProjectAnalyticsDataQualityBanner from './ProjectAnalyticsDataQualityBanner';
import ProjectBudgetQuickSet from './ProjectBudgetQuickSet';
import FinanceAssignProjectsBanner from '../finance/FinanceAssignProjectsBanner';
import ProjectAnalyticsKpiGrid from './ProjectAnalyticsKpiGrid';
import {
  formatProjectInr,
  formatBudgetDisplay,
  formatForeignSpendNote,
} from './ProjectAnalyticsTableBits';
import { hasPageAccess } from '../../utils/pagePermissions';
import { isAdminUser } from '../../utils/departmentPermissions';

const MemberBreakdownTable = ({ members = [], flaggedOnly = false }) => {
  const rows = flaggedOnly
    ? members.filter((m) => (m.flags || []).includes('hours_without_completions'))
    : members;

  return (
    <div>
      <p className="tm-widget-label mb-3">Member breakdown</p>
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] opacity-60">
            {flaggedOnly ? 'No member anomalies in this period.' : 'No member activity in this period.'}
          </p>
        ) : (
          <table className="w-full min-w-[520px] text-left text-xs border-collapse">
            <thead>
              <tr className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)]">
                <th className="pb-2 pr-3 font-semibold">Member</th>
                <th className="pb-2 pr-3 text-right font-semibold">Total h</th>
                <th className="pb-2 pr-3 text-right font-semibold">Manual</th>
                <th className="pb-2 pr-3 text-right font-semibold">Task</th>
                <th className="pb-2 pr-3 text-right font-semibold">Done</th>
                <th className="pb-2 text-right font-semibold">Flag</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.userId} className="border-b border-[var(--color-bg-border)]/50">
                  <td className="py-2 pr-3">
                    <UserLabel name={m.name} avatar={m.avatar} size="xs" nameClassName="font-bold text-xs" />
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-right">{m.hours?.toFixed(1)}</td>
                  <td className="py-2 pr-3 tabular-nums text-right">{m.manualHours?.toFixed(1)}</td>
                  <td className="py-2 pr-3 tabular-nums text-right">{m.taskHours?.toFixed(1)}</td>
                  <td className="py-2 pr-3 tabular-nums text-right">{m.tasksCompleted}</td>
                  <td className="py-2 text-right text-[10px] text-amber-400 font-semibold">
                    {(m.flags || []).includes('hours_without_completions') ? '0 completions' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const ProjectAnalyticsContent = ({ projectId, rangeState: externalRangeState, viewMode = 'member' }) => {
  const { user } = useAuth();
  const membersRef = useRef(null);
  const internalRangeState = useProjectReportRangeState();
  const [selectedDay, setSelectedDay] = useState(null);
  const [showFlaggedMembers, setShowFlaggedMembers] = useState(false);
  const [logFilterOpen, setLogFilterOpen] = useState(false);
  const [draftLogDay, setDraftLogDay] = useState('');

  const {
    queryParams,
    queryEnabled,
    rangeSubtitle,
    isAllTime,
  } = externalRangeState || internalRangeState;

  const { data: report, isLoading, isFetching, error, refetch } = useProjectAnalytics(projectId, queryParams, queryEnabled);

  const permissionLabel = useMemo(() => {
    if (viewMode === 'admin' || hasPageAccess(user, 'admin_project_analytics')) return 'Admin analytics';
    if (isAdminUser(user)) return 'Admin';
    return 'Member';
  }, [user, viewMode]);

  const subtitle = rangeSubtitle(report);
  const rangeSpendLabel = subtitle || (isAllTime ? 'All time' : 'Selected range');
  const effortSectionLabel = isAllTime ? 'all time' : 'selected range';
  const foreignNote = formatForeignSpendNote(report?.summary?.foreignSpendInRange);
  const manualPct = report?.summary?.totalHours
    ? Math.round((report.summary.manualLogHours / report.summary.totalHours) * 100)
    : 0;

  const effortKpis = useMemo(() => {
    if (!report?.summary) return [];
    const s = report.summary;
    const taskPct = s.totalHours ? Math.round((s.taskCompletionHours / s.totalHours) * 100) : 0;
    return [
      {
        id: 'total',
        label: 'Total hours',
        value: s.totalHours.toFixed(1),
        icon: Timer,
      },
      {
        id: 'manual',
        label: 'Manual logs',
        value: s.manualLogHours.toFixed(1),
        badge: `${manualPct}%`,
        icon: NotebookPen,
      },
      {
        id: 'task',
        label: 'Task hours',
        value: s.taskCompletionHours.toFixed(1),
        badge: `${taskPct}%`,
        icon: BarChart3,
      },
      {
        id: 'logs',
        label: 'Daily logs',
        value: String(s.logEntries),
        hint: report.dataQuality?.duplicateLogsCollapsed ? 'Dedup applied' : undefined,
        badge: report.dataQuality?.duplicateLogsCollapsed
          ? `${report.dataQuality.duplicateLogsCollapsed} collapsed`
          : undefined,
        icon: ListChecks,
      },
      {
        id: 'done',
        label: 'Tasks done',
        value: String(s.tasksCompleted),
        hint: `of ${s.tasksTotal} active in range`,
        icon: CheckCircle2,
      },
    ];
  }, [report, manualPct]);

  const burnRatePerDay = useMemo(() => {
    const days = report?.window?.days || 1;
    const spendBase = isAllTime
      ? (report?.summary?.spentTotal || 0)
      : (report?.summary?.spentInRange || 0);
    return spendBase / days;
  }, [report, isAllTime]);

  const financeKpis = useMemo(() => {
    if (!report?.summary) return [];
    const s = report.summary;
    const budgetLabel = formatBudgetDisplay(s.hasBudget, s.budget);
    const spentInRange = s.spentInRange > 0 ? formatProjectInr(s.spentInRange) : '—';
    const spentAllTime = s.spentTotal > 0 ? formatProjectInr(s.spentTotal) : '—';
    const revenueAllTime = s.revenueTotal > 0 ? formatProjectInr(s.revenueTotal) : '—';
    const revenueInRange = s.revenueInRange > 0 ? formatProjectInr(s.revenueInRange) : '—';
    return [
      {
        id: 'budget',
        label: 'Total budget',
        value: budgetLabel,
        textValue: !s.hasBudget,
        compact: true,
        icon: Wallet,
      },
      {
        id: 'spent',
        label: 'Spent',
        value: isAllTime ? spentAllTime : spentInRange,
        badge: !isAllTime && s.spentTotal > 0 ? `${spentAllTime} all-time` : undefined,
        hint: foreignNote ? `+ ${foreignNote} converted to INR` : undefined,
        icon: IndianRupee,
      },
      {
        id: 'remaining',
        label: 'Remaining',
        value: s.hasBudget ? formatProjectInr(s.remaining) : '—',
        hint: s.hasBudget ? 'Budget minus all-time verified spend' : 'No budget configured',
        icon: PiggyBank,
      },
      {
        id: 'revenue',
        label: 'Revenue',
        value: isAllTime ? revenueAllTime : revenueInRange,
        badge: !isAllTime ? 'in range' : undefined,
        hint: isAllTime ? undefined : rangeSpendLabel,
        icon: TrendingUp,
      },
      {
        id: 'burn',
        label: 'Burn / day',
        value: burnRatePerDay > 0 ? formatProjectInr(burnRatePerDay) : '—',
        hint: isAllTime ? 'All-time spend ÷ window days' : rangeSpendLabel,
        icon: IndianRupee,
      },
    ];
  }, [report, foreignNote, rangeSpendLabel, isAllTime, burnRatePerDay]);

  const drillLogs = useMemo(() => {
    const logs = report?.recentLogs || [];
    if (!selectedDay) return logs;
    return logs.filter((l) => (l.date || '').slice(0, 10) === selectedDay);
  }, [report?.recentLogs, selectedDay]);

  const logFilterFields = useMemo(() => ([
    {
      id: 'logDay',
      label: 'Log day',
      type: 'custom',
      render: () => (
        <input
          type="date"
          value={draftLogDay}
          onChange={(e) => setDraftLogDay(e.target.value)}
          className="w-full min-h-[44px] px-3 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] text-xs"
        />
      ),
    },
  ]), [draftLogDay]);

  const logFilterActiveCount = selectedDay ? 1 : 0;
  const canEditBudget = viewMode === 'admin' || hasPageAccess(user, 'admin_project_analytics');

  const handleReviewMembers = () => {
    setShowFlaggedMembers(true);
    membersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!queryEnabled) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">
        Select a valid date range.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!externalRangeState && subtitle && (
        <p className="text-[10px] text-[var(--color-text-muted)]">{subtitle}</p>
      )}

      {externalRangeState && (
        <div className="flex flex-wrap items-center gap-2">
          {report?.project?.workspace && (
            <Badge variant="slate" className="w-fit">{report.project.workspace}</Badge>
          )}
          <Badge variant="info" className="w-fit !text-[9px] uppercase">{permissionLabel}</Badge>
          {subtitle && (
            <span className="text-[10px] text-[var(--color-text-muted)]">{subtitle}</span>
          )}
        </div>
      )}

      {isLoading && !report && <DataLoading />}
      {error && !report && (
        <QueryErrorBanner
          message={getQueryErrorMessage(error, 'Failed to load analytics.')}
          onRetry={() => refetch()}
        />
      )}

      {report && (
        <div className={isFetching ? 'opacity-70 pointer-events-none transition-opacity' : 'transition-opacity'}>
          {(viewMode === 'admin' || hasPageAccess(user, 'admin_project_analytics')) && (
            <div className="mb-4">
              <FinanceAssignProjectsBanner />
            </div>
          )}
          <ProjectAnalyticsDataQualityBanner
            dataQuality={report.dataQuality}
            onReviewMembers={handleReviewMembers}
          />

          <section className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              Effort · {effortSectionLabel}
            </h3>
            <ProjectAnalyticsKpiGrid items={effortKpis} columns={5} />
          </section>

          <section className="space-y-3 mt-8">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              Financial · project finance docs
            </h3>
            <ProjectAnalyticsKpiGrid items={financeKpis} columns={5} />
            <ProjectBudgetQuickSet
              projectId={projectId}
              hasBudget={report.summary.hasBudget}
              canEdit={canEditBudget}
            />
          </section>

          {(report.summary.laborCostInr != null || report.summary.estimatedTotalCostInr != null) && (
            <Card className="p-4 mt-8 border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                    Estimated total cost
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                    Labor ({report.summary.totalHours.toFixed(1)}h
                    {report.summary.laborRateInr ? ` × ₹${report.summary.laborRateInr}/h` : ''})
                    {' '}+ verified spend in range
                  </p>
                </div>
                <p className="text-lg font-bold tabular-nums">
                  {formatProjectInr(report.summary.estimatedTotalCostInr)}
                </p>
              </div>
            </Card>
          )}

          <section className="mt-8 pt-6 border-t border-[var(--color-bg-border)]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="tm-widget-label">Hours trend</h3>
              <div className="flex items-center gap-2">
                <FilterToolbarButton
                  activeCount={logFilterActiveCount}
                  onClick={() => {
                    setDraftLogDay(selectedDay || '');
                    setLogFilterOpen(true);
                  }}
                />
                {selectedDay && (
                  <button
                    type="button"
                    className="text-[10px] font-bold uppercase text-blue-400 hover:underline"
                    onClick={() => setSelectedDay(null)}
                  >
                    Clear · {selectedDay}
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mb-3">Use filters to narrow recent logs by day.</p>
            <DailyLogHoursChart
              byDay={report.byDay}
              totalEntries={report.summary.logEntries}
              onDaySelect={setSelectedDay}
              selectedDay={selectedDay}
              hideDayChips
            />
            <SelectionFilterPanel
              open={logFilterOpen}
              onClose={() => setLogFilterOpen(false)}
              title="Log filters"
              fields={logFilterFields}
              onApply={() => {
                setSelectedDay(draftLogDay || null);
                setLogFilterOpen(false);
              }}
              onClear={() => {
                setDraftLogDay('');
                setSelectedDay(null);
              }}
            />
          </section>

          <section className="mt-8 pt-6 border-t border-[var(--color-bg-border)]">
            <h3 className="tm-widget-label mb-3">Spend documents</h3>
            <ProjectFinanceDocumentsTable
              documents={report.finance?.documents}
              rangeLabel={rangeSpendLabel}
            />
          </section>

          <Card ref={membersRef} className="p-4 mt-8 overflow-hidden border border-[var(--color-bg-border)]">
            <MemberBreakdownTable
              members={report.byMember}
              flaggedOnly={showFlaggedMembers}
            />
          </Card>

          <Card className="p-4 mt-6 overflow-hidden border border-[var(--color-bg-border)]">
            <h3 className="tm-widget-label mb-3">Open tasks</h3>
            <ProjectOpenTasksTable tasks={report.openTasks} />
          </Card>

          <section className="mt-8 pt-6 border-t border-[var(--color-bg-border)]">
            <h3 className="tm-widget-label mb-3">
              Recent daily logs
              {selectedDay ? ` · ${selectedDay}` : ''}
            </h3>
            <DailyLogsTable entries={drillLogs} showMember />
          </section>
        </div>
      )}
    </div>
  );
};

export default ProjectAnalyticsContent;

