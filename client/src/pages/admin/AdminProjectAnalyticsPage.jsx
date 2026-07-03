import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3, Search, ChevronRight, ChevronLeft, Clock, NotebookPen, CheckCircle2, ListChecks,
  IndianRupee, Wallet, TrendingUp, PiggyBank,
} from 'lucide-react';
import {
  HoursMixBar,
  BudgetUsedCell,
  ProgressCell,
  formatProjectInr,
  formatBudgetDisplay,
} from '../../components/project/ProjectAnalyticsTableBits';
import {
  Card,
  DataLoading,
  DataTable,
  SearchInput,
  PageContainer,
  PageHeader,
  Button,
  DesktopRecommendedBanner,
  QueryErrorBanner,
  getQueryErrorMessage,
} from '../../components/ui';
import { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import ProjectReportRangeControls from '../../components/project/ProjectReportRangeControls';
import ProjectAnalyticsContent from '../../components/project/ProjectAnalyticsContent';
import ProjectAnalyticsKpiGrid from '../../components/project/ProjectAnalyticsKpiGrid';
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
      const id = row.projectId?.toString?.() || String(row.projectId || '');
      if (id) map.set(id, row);
    });
    return map;
  }, [summary]);

  const allProjectRows = useMemo(() => projects
    .map((project) => {
      const projectKey = project._id?.toString?.() || String(project._id || '');
      const stats = summaryByProjectId.get(projectKey) || {};
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
        hasBudget: stats.hasBudget ?? false,
        budget: stats.budget ?? null,
        spentTotal: stats.spentTotal || 0,
        spentInRange: stats.spentInRange || 0,
        revenueInRange: stats.revenueInRange || 0,
        remaining: stats.remaining || 0,
        budgetUsedPct: stats.budgetUsedPct ?? null,
        spendByCategory: stats.spendByCategory || {},
      };
    }), [projects, summaryByProjectId]);

  const rows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allProjectRows
      .filter((row) => {
        if (!q) return true;
        return `${row.name} ${row.workspace}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.totalHours - a.totalHours || a.name.localeCompare(b.name));
  }, [allProjectRows, searchTerm]);

  const totals = useMemo(() => (summary?.projects || []).reduce(
    (acc, row) => ({
      totalHours: acc.totalHours + (row.totalHours || 0),
      manualLogHours: acc.manualLogHours + (row.manualLogHours || 0),
      taskCompletionHours: acc.taskCompletionHours + (row.taskCompletionHours || 0),
      logCount: acc.logCount + (row.logCount || 0),
      tasksCompleted: acc.tasksCompleted + (row.tasksCompleted || 0),
      budget: acc.budget + (row.hasBudget && row.budget ? row.budget : 0),
      spentTotal: acc.spentTotal + (row.spentTotal || 0),
      spentInRange: acc.spentInRange + (row.spentInRange || 0),
      remaining: acc.remaining + (row.hasBudget && row.remaining != null ? row.remaining : 0),
      revenueInRange: acc.revenueInRange + (row.revenueInRange || 0),
    }),
    {
      totalHours: 0,
      manualLogHours: 0,
      taskCompletionHours: 0,
      logCount: 0,
      tasksCompleted: 0,
      budget: 0,
      spentTotal: 0,
      spentInRange: 0,
      remaining: 0,
      revenueInRange: 0,
    }
  ), [summary?.projects]);

  const portfolioHasBudget = (summary?.projects || []).some((r) => r.hasBudget);

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
          {formatBudgetDisplay(row.hasBudget, row.budget)}
        </span>
      ),
    },
    {
      key: 'spentInRange',
      header: 'Spent',
      render: (row) => (
        <span className="tabular-nums text-xs" title="Spend in selected date range">
          {formatProjectInr(row.spentInRange)}
        </span>
      ),
    },
    {
      key: 'remaining',
      header: 'Left',
      render: (row) => (
        <span className="tabular-nums text-xs" title="Budget minus all-time verified spend">
          {row.hasBudget ? formatProjectInr(row.remaining) : '—'}
        </span>
      ),
    },
    {
      key: 'budgetUsedPct',
      header: '% budget',
      render: (row) => <BudgetUsedCell budgetUsedPct={row.budgetUsedPct} hasBudget={row.hasBudget} />,
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

      {queryEnabled && !selectedProjectId && (
        <>
          <section className={`space-y-3 ${summaryFetching ? 'opacity-60' : ''}`}>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              Effort · all projects
            </h3>
            <ProjectAnalyticsKpiGrid
              columns={5}
              items={[
                {
                  id: 'total',
                  label: 'Total hours',
                  value: totals.totalHours.toFixed(1),
                  icon: Clock,
                },
                {
                  id: 'manual',
                  label: 'Manual logs',
                  value: totals.manualLogHours.toFixed(1),
                  badge: `${((totals.manualLogHours / (totals.totalHours || 1)) * 100).toFixed(0)}%`,
                  icon: NotebookPen,
                },
                {
                  id: 'task',
                  label: 'Task hours',
                  value: totals.taskCompletionHours.toFixed(1),
                  badge: `${((totals.taskCompletionHours / (totals.totalHours || 1)) * 100).toFixed(0)}%`,
                  icon: BarChart3,
                },
                { id: 'logs', label: 'Daily logs', value: String(totals.logCount), icon: ListChecks },
                { id: 'done', label: 'Tasks done', value: String(totals.tasksCompleted), icon: CheckCircle2 },
              ]}
            />
          </section>

          <section className={`space-y-3 mt-8 ${summaryFetching ? 'opacity-60' : ''}`}>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              Financial · all projects
            </h3>
            <ProjectAnalyticsKpiGrid
              columns={5}
              items={[
                {
                  id: 'budget',
                  label: 'Total budget',
                  value: portfolioHasBudget ? formatProjectInr(totals.budget) : 'No budget set',
                  textValue: !portfolioHasBudget,
                  compact: true,
                  icon: Wallet,
                },
                {
                  id: 'spent',
                  label: 'Spent in range',
                  value: totals.spentInRange > 0 ? formatProjectInr(totals.spentInRange) : '—',
                  hint: subtitle || undefined,
                  icon: IndianRupee,
                },
                {
                  id: 'remaining',
                  label: 'Remaining',
                  value: portfolioHasBudget ? formatProjectInr(totals.remaining) : '—',
                  icon: PiggyBank,
                },
                {
                  id: 'revenue',
                  label: 'Revenue in range',
                  value: totals.revenueInRange > 0 ? formatProjectInr(totals.revenueInRange) : '—',
                  icon: TrendingUp,
                },
                {
                  id: 'burn',
                  label: 'Burn per day',
                  value: burnRatePerDay > 0 ? formatProjectInr(burnRatePerDay) : '—',
                  icon: IndianRupee,
                },
              ]}
            />
          </section>

          <Card className="p-4 space-y-4 mt-8">
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
        </>
      )}

      {queryEnabled && selectedProjectId && (
        <div ref={detailSectionRef} className="space-y-4 scroll-mt-4">
              <div className="sticky top-0 z-20 -mx-1 px-1 py-3 bg-[var(--color-bg-primary)]/95 border-b border-[var(--color-bg-border)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => selectProject(null)}
                      className="!text-[10px] !font-bold !uppercase !tracking-wide shrink-0"
                    >
                      <ChevronLeft size={14} aria-hidden />
                      Back to overview
                    </Button>
                    <h2 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-primary)] truncate min-w-0">
                      {selectedProject?.name || 'Project'} — detailed analytics
                    </h2>
                  </div>
                  {subtitle && (
                    <p className="text-[10px] text-[var(--color-text-muted)]">{subtitle}</p>
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
                </div>
              </div>
              <ProjectAnalyticsContent projectId={selectedProjectId} rangeState={rangeState} viewMode="admin" />
        </div>
      )}
    </PageContainer>
  );
};

export default AdminProjectAnalyticsPage;
