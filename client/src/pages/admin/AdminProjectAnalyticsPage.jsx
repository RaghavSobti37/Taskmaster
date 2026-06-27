import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Search, ChevronRight, Clock, NotebookPen, CheckCircle2, ListChecks } from 'lucide-react';
import {
  Badge,
  Card,
  DataLoading,
  DataTable,
  Input,
  PageContainer,
  PageHeader,
  StatCard,
  DesktopRecommendedBanner,
} from '../../components/ui';
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

  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const deferSummary = useDeferredQueryEnabled(!projectsLoading);
  const { data: summary, isLoading: summaryLoading, isFetching: summaryFetching, error: summaryError } = useProjectsAnalyticsSummary(
    queryParams,
    queryEnabled && deferSummary
  );

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
          totalHours: stats.totalHours || 0,
          manualLogHours: stats.manualLogHours || 0,
          taskCompletionHours: stats.taskCompletionHours || 0,
          logCount: stats.logCount || 0,
          tasksCompleted: stats.tasksCompleted || 0,
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
    }),
    { totalHours: 0, manualLogHours: 0, taskCompletionHours: 0, logCount: 0, tasksCompleted: 0 }
  ), [rows]);

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
      render: (row) => row.totalHours.toFixed(1),
    },
    {
      key: 'manualLogHours',
      header: 'Manual h',
      render: (row) => row.manualLogHours.toFixed(1),
    },
    {
      key: 'taskCompletionHours',
      header: 'Task h',
      render: (row) => row.taskCompletionHours.toFixed(1),
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
      key: 'progress',
      header: 'Progress',
      render: (row) => `${row.progress}%`,
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Total Hours" value={totals.totalHours.toFixed(1)} icon={Clock} variant="info" />
            <StatCard label="Manual Logs" value={totals.manualLogHours.toFixed(1)} icon={NotebookPen} variant="mint" />
            <StatCard label="Task Hours" value={totals.taskCompletionHours.toFixed(1)} icon={BarChart3} variant="apricot" />
            <StatCard label="Daily Logs" value={totals.logCount} icon={ListChecks} variant="slate" />
            <StatCard label="Tasks Done" value={totals.tasksCompleted} icon={CheckCircle2} variant="rose" />
          </div>

          <Card className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                All projects ({rows.length})
              </p>
              <div className="w-full max-w-xs">
                <Input
                  icon={Search}
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="!py-1 !text-[11px]"
                />
              </div>
            </div>

            {(summaryLoading && !summary) || (projectsLoading && !projects.length) ? (
              <DataLoading />
            ) : null}
            {summaryError && !summary && (
              <p className="text-sm text-red-500">
                {summaryError.response?.data?.error || summaryError.message || 'Failed to load summary.'}
              </p>
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
