import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import { Card, Badge } from '../ui';
import { isToday, startOfDay } from 'date-fns';
import { formatProjectName } from '../../utils/projectUtils';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { getTaskWorkspace, getWorkspaceColor } from '../../utils/workspaceColors';

const getTaskDay = (task) => {
  const raw = task.scheduleDate || task.dueDate;
  if (!raw) return null;
  return startOfDay(new Date(raw));
};

const ProjectsTodayCard = ({ tasks = [], projects = [], loading }) => {
  const navigate = useNavigate();
  const { data: workspaces = [] } = useWorkspaces();

  const groups = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (t.status === 'done') return;
      const day = getTaskDay(t);
      if (!day || !isToday(day)) return;
      const pid = t.projectId?._id || t.projectId;
      if (!pid) return;
      const key = pid.toString();
      if (!map.has(key)) {
        const proj = projects.find((p) => p._id?.toString() === key) || t.projectId;
        map.set(key, { project: proj, count: 0, tasks: [] });
      }
      const g = map.get(key);
      g.count += 1;
      g.tasks.push(t);
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [tasks, projects]);

  return (
    <Card className="p-0 flex flex-col shadow-md overflow-hidden shrink-0">
      <div className="p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
        <h4 className="tm-section-label flex items-center gap-2 text-[var(--color-text-primary)]">
          <FolderKanban size={16} className="text-violet-500" /> Projects with Tasks Today
        </h4>
        <Badge variant="info">{groups.length}</Badge>
      </div>
      <div className="p-3 space-y-2">
        {loading && <p className="text-xs text-[var(--color-text-muted)] p-2">Loading...</p>}
        {!loading && groups.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)] italic text-center py-8">No project tasks today</p>
        )}
        {groups.map(({ project, count, tasks: pTasks }) => {
          const pid = project?._id || project;
          const workspaceName = project?.workspace || getTaskWorkspace(pTasks[0]);
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
                  <p className="tm-task-title truncate">{formatProjectName(project?.name || 'Project')}</p>
                  <p className="tm-caption mt-0.5 truncate">
                    {pTasks.slice(0, 2).map((t) => t.title).join(' · ')}
                  </p>
                </div>
                <Badge variant="info" className="shrink-0">{count}</Badge>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default ProjectsTodayCard;
