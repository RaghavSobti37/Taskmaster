import React, { useMemo } from 'react';
import { ListTodo } from 'lucide-react';
import { DataLoading } from '../ui';
import { LOADING_SHOW_PHRASE_DASHBOARD } from '../../lib/loadingDisplay';
import DashboardWidgetFrame from './DashboardWidgetFrame';
import DashboardTaskRow from './DashboardTaskRow';
import { useDashboardLayout } from './DashboardLayoutContext';
import { resolveTaskWorkspaceColor } from '../../utils/workspaceColors';
import { filterTasksByTimeframe, sortTasksByDate, isTaskOverdue, filterOverdueTasks } from '../../utils/dashboardTasks';

const COMPACT_LIMIT = 4;

/**
 * Combined today + overdue tasks for daily-action row.
 */
export default function MyTasksDashboardCard({
  tasks = [],
  projects = [],
  workspaces = [],
  loading,
  onComplete,
  completingTaskId,
}) {
  const { expandContent } = useDashboardLayout();
  const { todayItems, overdueCount } = useMemo(() => {
    const today = sortTasksByDate(filterTasksByTimeframe(tasks, '1d'), 'asc');
    const overdue = filterOverdueTasks(tasks);
    const merged = [...overdue, ...today.filter((t) => !isTaskOverdue(t))];
    const seen = new Set();
    const unique = merged.filter((t) => {
      const id = String(t._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return { todayItems: unique.slice(0, COMPACT_LIMIT), overdueCount: overdue.length };
  }, [tasks]);

  const subtitle = overdueCount > 0 ? `incl. ${overdueCount} overdue` : 'daily action';

  return (
    <DashboardWidgetFrame
      componentId="my-tasks"
      href="/todo"
      viewAllHref="/todo"
      compact={!expandContent}
      maxBodyHeight={expandContent ? undefined : 200}
      title={`My tasks (${subtitle})`}
      icon={ListTodo}
    >
      {loading && <DataLoading className="!py-3 px-3" showPhrase={LOADING_SHOW_PHRASE_DASHBOARD} />}
      {!loading && todayItems.length === 0 && (
        <p className="tm-caption italic text-center py-4 px-3">No tasks due. You&apos;re clear.</p>
      )}
      {!loading && todayItems.map((task) => (
        <DashboardTaskRow
          key={task._id}
          task={task}
          projects={projects}
          workspaceColor={resolveTaskWorkspaceColor(task, workspaces, projects)}
          onComplete={onComplete}
          onOpen={() => {}}
          isCompleting={completingTaskId === task._id}
        />
      ))}
    </DashboardWidgetFrame>
  );
}
