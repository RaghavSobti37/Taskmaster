import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, ArrowDown, ArrowUp } from 'lucide-react';
import { Card, Badge, Button } from '../ui';
import { formatProjectName } from '../../utils/projectUtils';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { getTaskWorkspace, getWorkspaceColor } from '../../utils/workspaceColors';
import {
  filterTodayTasks,
  filterOverdueTasks,
  sortTasksByPriority,
  sortTasksByDate,
} from '../../utils/dashboardTasks';

const buildProjectGroups = (tasks, sortFn) => {
  const map = new Map();

  tasks.forEach((t) => {
    const pid = t.projectId?._id || t.projectId;
    if (!pid) return;
    const key = pid.toString();
    if (!map.has(key)) {
      map.set(key, { project: t.projectId, count: 0, tasks: [] });
    }
    const g = map.get(key);
    g.count += 1;
    g.tasks.push(t);
  });

  return [...map.values()]
    .map((g) => ({
      ...g,
      tasks: sortFn(g.tasks),
    }))
    .sort((a, b) => b.count - a.count);
};

const ProjectGroupList = ({ groups, projects, workspaces, navigate, emptyMessage }) => {
  if (groups.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)] italic text-center py-6">{emptyMessage}</p>;
  }

  return groups.map(({ project, count, tasks: pTasks }) => {
    const pid = project?._id || project;
    const proj = projects.find((p) => p._id?.toString() === pid?.toString()) || project;
    const workspaceName = proj?.workspace || getTaskWorkspace(pTasks[0]);
    const color = getWorkspaceColor(workspaceName, workspaces);

    return (
      <button
        key={pid}
        type="button"
        onClick={() => navigate(`/projects/${pid}`)}
        className="w-full text-left flex items-stretch rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] transition-colors hover:bg-[var(--color-bg-secondary)] overflow-hidden"
      >
        <div className="w-1 shrink-0" style={{ backgroundColor: color }} aria-hidden />
        <div className="flex items-center justify-between gap-2 flex-1 min-w-0 p-3">
          <div className="min-w-0">
            <p className="tm-task-title truncate">{formatProjectName(proj?.name || 'Project')}</p>
            <p className="tm-caption mt-0.5 truncate">
              {pTasks.slice(0, 2).map((t) => t.title).join(' · ')}
            </p>
          </div>
          <Badge variant="info" className="shrink-0">{count}</Badge>
        </div>
      </button>
    );
  });
};

const ProjectsTodayCard = ({ tasks = [], projects = [], loading }) => {
  const navigate = useNavigate();
  const { data: workspaces = [] } = useWorkspaces();
  const [overdueSort, setOverdueSort] = useState('desc');
  const [todaySort, setTodaySort] = useState('asc');

  const overdueGroups = useMemo(() => {
    const filtered = filterOverdueTasks(tasks);
    return buildProjectGroups(filtered, (list) => sortTasksByPriority(list, overdueSort));
  }, [tasks, overdueSort]);

  const todayGroups = useMemo(() => {
    const filtered = filterTodayTasks(tasks);
    return buildProjectGroups(filtered, (list) => sortTasksByDate(list, todaySort));
  }, [tasks, todaySort]);

  return (
    <Card className="p-0 flex flex-col shadow-md overflow-hidden shrink-0">
      <div className="p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
        <h4 className="tm-section-label flex items-center gap-2 text-[var(--color-text-primary)]">
          <FolderKanban size={16} className="text-[var(--color-brand-teal)]" /> Projects — Today & Overdue
        </h4>
        <Badge variant="info">{overdueGroups.length + todayGroups.length}</Badge>
      </div>

      <div className="border-b border-[var(--color-bg-border)]">
        <div className="px-4 py-3 bg-[var(--color-bg-secondary)]/60 flex items-center justify-between">
          <h5 className="tm-section-label text-[var(--color-text-primary)]">Overdue</h5>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setOverdueSort((d) => (d === 'desc' ? 'asc' : 'desc'))}
              className="!px-2 !py-1 gap-1"
            >
              {overdueSort === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              <span className="text-[9px] font-bold uppercase">{overdueSort === 'asc' ? 'Asc' : 'Desc'}</span>
            </Button>
            <Badge variant={overdueGroups.length > 0 ? 'overdue' : 'info'}>{overdueGroups.length}</Badge>
          </div>
        </div>
        <div className="p-3 space-y-2">
          {loading && <p className="text-xs text-[var(--color-text-muted)] p-2">Loading...</p>}
          {!loading && (
            <ProjectGroupList
              groups={overdueGroups}
              projects={projects}
              workspaces={workspaces}
              navigate={navigate}
              emptyMessage="No overdue project tasks"
            />
          )}
        </div>
      </div>

      <div>
        <div className="px-4 py-3 bg-[var(--color-bg-secondary)]/60 flex items-center justify-between">
          <h5 className="tm-section-label text-[var(--color-text-primary)]">Today</h5>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setTodaySort((d) => (d === 'asc' ? 'desc' : 'asc'))}
              className="!px-2 !py-1 gap-1"
            >
              {todaySort === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              <span className="text-[9px] font-bold uppercase">{todaySort === 'asc' ? 'Asc' : 'Desc'}</span>
            </Button>
            <Badge variant="info">{todayGroups.length}</Badge>
          </div>
        </div>
        <div className="p-3 space-y-2">
          {loading && <p className="text-xs text-[var(--color-text-muted)] p-2">Loading...</p>}
          {!loading && (
            <ProjectGroupList
              groups={todayGroups}
              projects={projects}
              workspaces={workspaces}
              navigate={navigate}
              emptyMessage="No project tasks due today"
            />
          )}
        </div>
      </div>
    </Card>
  );
};

export default ProjectsTodayCard;
