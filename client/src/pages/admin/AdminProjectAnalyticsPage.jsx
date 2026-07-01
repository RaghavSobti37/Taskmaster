import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3, Search, ChevronRight, Clock, NotebookPen, CheckCircle2, ListChecks,
  IndianRupee, Wallet, TrendingUp, PiggyBank,
} from 'lucide-react';
import {
  HoursMixBar,
  BudgetUsedCell,
  ProgressCell,
  formatProjectInr,
} from '../../components/project/ProjectAnalyticsTableBits';
import { SpendCategorySummary } from '../../components/project/ProjectFinanceSpendBreakdown';
import {
  Badge,
  Card,
  DataLoading,
  DataTable,
  SearchInput,
  PageContainer,
  PageHeader,
  StatCard,
  DesktopRecommendedBanner,
  QueryErrorBanner,
  getQueryErrorMessage,
} from '../../components/ui';
import { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import ProjectReportRangeControls from '../../components/project/ProjectReportRangeControls';
import ProjectAnalyticsContent from '../../components/project/ProjectAnalyticsContent';
import { useProjects, useProjectsAnalyticsSummary } from '../../hooks/useTaskmasterQueries';
import { useProjectReportRangeState } from '../../hooks/useProjectReportRangeState';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';

const AdminProjectAnalyticsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProjectId = searchParams.get('project') || '';
  const [searchTerm, setSearchTerm] = useState('');
  const detailSectionRef = useRef(null);

  const rangeState = useProjectReportRangeState();
  const { queryParams, queryEnabled, rangeSubtitle } = rangeState;

  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
    error: projectsErr,
    refetch: refetchProjects,
  } = useProjects();
  const deferSummary = useDeferredQueryEnabled(!projectsLoading);
  const {
    data: summary,
    isLoading: summaryLoading,
    isFetching: summaryFetching,
    isError: summaryIsError,
    error: summaryError,
    refetch: refetchSummary,
  } = useProjectsAnalyticsSummary(
    queryParams,
    queryEnabled && deferSummary
  );
  const listLoadError = projectsError ? projectsErr : summaryIsError ? summaryError : null;

  const summaryByProjectId = useMemo(() => {
    const map = new Map();
    (summary?.projects || []).forEach((row) => {
      const id = row.projectId?.toString?.() || row.projectId;
      if (id) map.set(id, row);
    });
    return map;
  }, [summary]);

  const rows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return projects
      .map((project) => {
        const stats = summaryByProjectId.get(project._id) || {};
        return {
          projectId: project._id,
          name: project.name,
          workspace: project.workspace || 'General',
          progress: project.progress || 0,
          completedTasks: project.completedTasksCount ?? project.completedTasks ?? 0,
          totalTasks: project.totalTasksCount ?? project.totalTasks ?? 0,
          totalHours: stats.totalHours || 0,
          manualLogHours: stats.manualLogHours || 0,
          taskCompletionHours: stats.taskCompletionHours || 0,
          logCount: stats.logCount || 0,
          tasksCompleted: stats.tasksCompleted || 0,
          budget: stats.budget || 0,
          spentTotal: stats.spentTotal || 0,
          spentInRange: stats.spentInRange || 0,
          revenueInRange: stats.revenueInRange || 0,
          remaining: stats.remaining || 0,
          budgetUsedPct: stats.budgetUsedPct ?? null,
          spendByCategory: stats.spendByCategory || {},
        };
      })
      .filter((row) => {
        if (!q) return true;
        return `${row.name} ${row.workspace}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.totalHours - a.totalHours || a.name.localeCompare(b.name));
  }, [projects, summaryByProjectId, searchTerm]);

  const totals = useMemo(() => rows.reduce(
    (acc, row) => ({
      totalHours: acc.totalHours + row.totalHours,
      manualLogHours: acc.manualLogHours + row.manualLogHours,
      taskCompletionHours: acc.taskCompletionHours + row.taskCompletionHours,
      logCount: acc.logCount + row.logCount,
      tasksCompleted: acc.tasksCompleted + row.tasksCompleted,
      budget: acc.budget + row.budget,
      spentInRange: acc.spentInRange + row.spentInRange,
      remaining: acc.remaining + row.remaining,
      revenueInRange: acc.revenueInRange + row.revenueInRange,
    }),
    {
      totalHours: 0,
      manualLogHours: 0,
      taskCompletionHours: 0,
      logCount: 0,
      tasksCompleted: 0,
      budget: 0,
      spentInRange: 0,
      remaining: 0,
      revenueInRange: 0,
    }
  ), [rows]);

  const burnRatePerDay = useMemo(() => {
    const days = summary?.window?.days || 1;
    return totals.spentInRange / days;
  }, [summary?.window?.days, totals.spentInRange]);

  const selectedProject = projects.find((p) => p._id === selectedProjectId);
  const subtitle = rangeSubtitle(summary);

  const selectProject = (projectId) => {
    if (!projectId) {
      setSearchParams({});
      return;
    }
    setSearchParams({ project: projectId });
  };

  useEffect(() => {
    if (!selectedProjectId || !detailSectionRef.current) return;
    detailSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedProjectId]);

  const columns = [
    {
      key: 'name',
      header: 'Project',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-bold truncate">{row.name}</p>
          <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">{row.workspace}</p>
        </div>
      ),
    },
    {
      key: 'totalHours',
      header: 'Total h',
      render: (row) => (
        <HoursMixBar
          totalHours={row.totalHours}
          manualLogHours={row.manualLogHours}
          taskCompletionHours={row.taskCompletionHours}
        />
      ),
    },
    {
      key: 'logCount',
      header: 'Logs',
      render: (row) => row.logCount,
    },
    {
      key: 'tasksCompleted',
      header: 'Tasks done',
      render: (row) => row.tasksCompleted,
    },
    {
      key: 'budget',
      header: 'Budget',
      render: (row) => (
        <span className="tabular-nums text-xs" title="Sum of budget docs in project Finance">
          {formatProjectInr(row.budget)}
        </span>
      ),
    },
    {
      key: 'spentInRange',
      header: 'Spent',
      render: (row) => {
        const primary = row.spentInRange > 0 ? row.spentInRange : row.spentTotal;
        const showTotalNote = row.spentTotal > 0 && row.spentInRange !== row.spentTotal;
        return (
          <div title={`In range · All-time ${formatProjectInr(row.spentTotal)}`}>
            <span className="tabular-nums text-xs">{formatProjectInr(primary)}</span>
            {showTotalNote && (
              <p className="text-[9px] text-[var(--color-text-muted)]">
                {row.spentInRange > 0 ? `${formatProjectInr(row.spentTotal)} total` : 'all-time'}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'spendByCategory',
      header: 'Spend mix',
      render: (row) => (
        <SpendCategorySummary
          spendByCategory={row.spendByCategory}
          mode={row.spentInRange > 0 ? 'inRange' : 'total'}
        />
      ),
    },
    {
      key: 'remaining',
      header: 'Left',
      render: (row) => (
        <span className="tabular-nums text-xs" title="Budget minus all-time spend">
          {row.budget > 0 ? formatProjectInr(row.remaining) : '—'}
        </span>
      ),
    },
    {
      key: 'budgetUsedPct',
      header: '% budget',
      render: (row) => <BudgetUsedCell budgetUsedPct={row.budgetUsedPct} />,
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (row) => (
        <ProgressCell
          progress={row.progress}
          completedTasks={row.completedTasks}
          totalTasks={row.totalTasks}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={() => selectProject(row.projectId)}
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-blue-500 hover:underline"
        >
          Details <ChevronRight size={12} />
        </button>
      ),
    },
  ];

  return (
    <PageContainer className="!py-4 !space-y-6">
      <DesktopRecommendedBanner message="Project analytics dashboards are best viewed on desktop for full chart detail." />
      <PageHeader
        icon={BarChart3}
        title="Project Analytics"
        backTo={ADMIN_CONSOLE_PATH}
      />

      {!selectedProjectId && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {subtitle && (
            <p className="text-[10px] text-[var(--color-text-muted)]">{subtitle}</p>
          )}
          <ProjectReportRangeControls
            rangeMode={rangeState.rangeMode}
            onRangeModeChange={rangeState.setRangeMode}
            timeframe={rangeState.timeframe}
            onTimeframeChange={rangeState.setTimeframe}
            customStart={rangeState.customStart}
            customEnd={rangeState.customEnd}
            onCustomStartChange={rangeState.setCustomStart}
            onCustomEndChange={rangeState.setCustomEnd}
          />
        </div>
      )}

      {!queryEnabled && (
        <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">
          Select a valid date range.
        </div>
      )}

      {queryEnabled && (
        <>
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              Effort · selected range
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard
                label="Total Hours"
                value={totals.totalHours.toFixed(1)}
                icon={Clock}
                variant="info"
                info="Manual log hours + task completion hours in the selected date range."
              />
              <StatCard
                label="Manual Logs"
                value={totals.manualLogHours.toFixed(1)}
                icon={NotebookPen}
                variant="mint"
                subValue={`${((totals.manualLogHours / (totals.totalHours || 1)) * 100).toFixed(0)}%`}
              />
              <StatCard
                label="Task Hours"
                value={totals.taskCompletionHours.toFixed(1)}
                icon={BarChart3}
                variant="apricot"
                subValue={`${((totals.taskCompletionHours / (totals.totalHours || 1)) * 100).toFixed(0)}%`}
              />
              <StatCard label="Daily Logs" value={totals.logCount} icon={ListChecks} variant="slate" />
              <StatCard
                label="Tasks Done"
                value={totals.tasksCompleted}
                icon={CheckCircle2}
                variant="rose"
                info="Tasks marked done within the selected date range (not all-time project progress)."
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              Financial · from project Finance docs
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard
                label="Total Budget"
                value={formatProjectInr(totals.budget)}
                icon={Wallet}
                variant="slate"
                info="Sum of Budget-category documents uploaded per project (all-time)."
              />
              <StatCard
                label="Spent"
                value={formatProjectInr(totals.spentInRange)}
                icon={IndianRupee}
                variant="apricot"
                subValue="in range"
                info="Invoices, receipts, and tax docs dated inside the selected range."
              />
              <StatCard
                label="Remaining"
                value={formatProjectInr(totals.remaining)}
                icon={PiggyBank}
                variant="mint"
                info="Budget minus all-time spend (not range-limited)."
              />
              <StatCard
                label="Revenue"
                value={formatProjectInr(totals.revenueInRange)}
                icon={TrendingUp}
                variant="info"
                subValue="in range"
                info="Contract and proposal amounts dated in range. Upload finance docs per project to populate."
              />
              <StatCard
                label="Burn / day"
                value={formatProjectInr(burnRatePerDay)}
                icon={IndianRupee}
                variant="rose"
                info="Range spend ÷ days in window. Not hourly-rate based — uses actual finance doc amounts."
              />
            </div>
          </div>

          <Card className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                All projects ({rows.length})
              </p>
              <div className="w-full max-w-xs">
                <SearchInput
                  variant="toolbar"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="!w-full"
                />
              </div>
            </div>

            {(summaryLoading && !summary) || (projectsLoading && !projects.length) ? (
              <DataLoading />
            ) : null}
            {listLoadError && (
              <QueryErrorBanner
                message={getQueryErrorMessage(listLoadError, 'Failed to load project analytics')}
                onRetry={() => {
                  if (projectsError) refetchProjects();
                  if (summaryIsError) refetchSummary();
                }}
              />
            )}
            {!summaryLoading && !projectsLoading && (
              <div className={summaryFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
              <DataTable
                columns={columns}
                data={rows}
                onRowClick={(row) => selectProject(row.projectId)}
                emptyTitle="No projects found"
                emptyDescription="No projects match your search."
              />
              </div>
            )}
          </Card>

          {selectedProjectId && (
            <div ref={detailSectionRef} className="space-y-4 scroll-mt-4">
              <div className="sticky top-0 z-20 -mx-1 px-1 py-3 bg-[var(--color-bg-primary)]/95 border-b border-[var(--color-bg-border)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <h2 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-primary)] truncate">
                    {selectedProject?.name || 'Project'} — detailed analytics
                  </h2>
                  {subtitle && (
                    <p className="text-[10px] text-[var(--color-text-muted)]">{subtitle}</p>
                  )}
                  {selectedProject && (
                    <Badge variant="info" className="w-fit">
                      Viewing: {selectedProject.name}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <ProjectReportRangeControls
                    rangeMode={rangeState.rangeMode}
                    onRangeModeChange={rangeState.setRangeMode}
                    timeframe={rangeState.timeframe}
                    onTimeframeChange={rangeState.setTimeframe}
                    customStart={rangeState.customStart}
                    customEnd={rangeState.customEnd}
                    onCustomStartChange={rangeState.setCustomStart}
                    onCustomEndChange={rangeState.setCustomEnd}
                  />
                  <button
                    type="button"
                    onClick={() => selectProject(null)}
                    className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] whitespace-nowrap"
                  >
                    Back to overview
                  </button>
                </div>
              </div>
              <ProjectAnalyticsContent projectId={selectedProjectId} rangeState={rangeState} />
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
};

export default AdminProjectAnalyticsPage;
