import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Card, Badge, DataLoading } from '../ui';
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
    <Card className="p-0 flex flex-col shadow-md overflow-hidden h-full">
      <button
        type="button"
        onClick={() => navigate('/todo')}
        className="p-4 border-b border-[var(--color-bg-border)] bg-red-50 dark:bg-red-900/10 flex items-center justify-between w-full text-left hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors shrink-0"
      >
        <h4 className="tm-section-label flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertCircle size={16} /> Overdue Tasks
        </h4>
        <Badge variant="overdue">{overdueTasks.length}</Badge>
      </button>

      <div className="p-3 space-y-2 overflow-y-auto custom-scrollbar flex-1">
        {loading && <DataLoading message="Loading overdue tasks..." className="!py-3" />}
        {!loading && overdueTasks.length === 0 && (
          <p className="tm-caption italic text-center py-4 text-green-600 dark:text-green-400">All caught up! No overdue tasks.</p>
        )}
        {!loading && overdueTasks.map((task) => (
          <DashboardTaskRow
            key={task._id}
            task={task}
            workspaceColor={resolveTaskWorkspaceColor(task, workspaces, projects)}
            onComplete={onComplete}
            onOpen={openTask}
            isCompleting={completingTaskId === task._id}
          />
        ))}
      </div>
    </Card>
  );
};

export default TodosOverdueCard;
