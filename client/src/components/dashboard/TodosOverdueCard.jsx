import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { DashboardWidgetShell, Badge, DataLoading } from '../ui';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { resolveTaskWorkspaceColor } from '../../utils/workspaceColors';
import { filterOverdueTasks, sortTasksByPriority } from '../../utils/dashboardTasks';
import DashboardTaskRow from './DashboardTaskRow';

const TodosOverdueCard = ({ tasks = [], projects = [], loading, onComplete, onOpenTodo, completingTaskId = null }) => {
  const navigate = useNavigate();
  const { data: workspaces = [] } = useWorkspaces();

  const overdueTasks = useMemo(
    () => sortTasksByPriority(filterOverdueTasks(tasks), 'desc'),
    [tasks]
  );

  const openTask = (task) => {
    if (onOpenTodo) onOpenTodo(task);
    else navigate('/todo');
  };

  return (
    <DashboardWidgetShell
      className="h-full overflow-hidden"
      bodyClassName="p-0 flex flex-col flex-1 min-h-0"
      headerClassName="hover:bg-[var(--color-bg-secondary)] transition-colors"
      title={
        <button
          type="button"
          onClick={() => navigate('/todo')}
          className="flex items-center gap-2 text-left text-red-700 dark:text-red-400 hover:opacity-80 transition-opacity"
        >
          Overdue Tasks
        </button>
      }
      icon={AlertCircle}
      actions={<Badge variant="overdue">{overdueTasks.length}</Badge>}
    >
      <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
        {loading && <DataLoading message="Loading overdue tasks..." className="!py-3" />}
        {!loading && overdueTasks.length === 0 && (
          <p className="tm-caption italic text-center py-4 text-green-600 dark:text-green-400">All caught up! No overdue tasks.</p>
        )}
        {!loading && overdueTasks.map((task) => (
          <DashboardTaskRow
            key={task._id}
            task={task}
            projects={projects}
            workspaceColor={resolveTaskWorkspaceColor(task, workspaces, projects)}
            onComplete={onComplete}
            onOpen={openTask}
            isCompleting={completingTaskId === task._id}
          />
        ))}
      </div>
    </DashboardWidgetShell>
  );
};

export default TodosOverdueCard;
