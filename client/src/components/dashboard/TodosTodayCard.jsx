import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTodo } from 'lucide-react';
import { Card, Badge, DataLoading } from '../ui';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { resolveTaskWorkspaceColor } from '../../utils/workspaceColors';
import { filterDashboardFocusTasks, isTaskOverdue } from '../../utils/dashboardTasks';
import DashboardTaskRow from './DashboardTaskRow';

const TodosTodayCard = ({ tasks = [], projects = [], loading, onComplete, onOpenTodo, completingTaskId = null }) => {
  const navigate = useNavigate();
  const { data: workspaces = [] } = useWorkspaces();

  const focusTasks = useMemo(() => filterDashboardFocusTasks(tasks), [tasks]);
  const overdueCount = useMemo(() => focusTasks.filter(isTaskOverdue).length, [focusTasks]);

  const openTask = (task) => {
    if (onOpenTodo) onOpenTodo(task);
    else navigate('/todo');
  };

  return (
    <Card className="p-0 flex flex-col shadow-md overflow-hidden shrink-0">
      <button
        type="button"
        onClick={() => navigate('/todo')}
        className="p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between w-full text-left hover:bg-[var(--color-bg-border)]/30 transition-colors shrink-0"
      >
        <div>
          <h4 className="tm-section-label flex items-center gap-2 text-[var(--color-text-primary)]">
            <ListTodo size={16} className="text-[var(--color-brand-teal)]" /> Today & Overdue
          </h4>
          {overdueCount > 0 && (
            <p className="tm-caption mt-0.5 ml-6">{overdueCount} overdue</p>
          )}
        </div>
        <Badge variant={overdueCount > 0 ? 'overdue' : 'info'}>{focusTasks.length}</Badge>
      </button>
      <div
        className={`p-3 space-y-2 ${
          focusTasks.length > 5 ? 'max-h-[min(50vh,400px)] overflow-y-auto custom-scrollbar' : ''
        }`}
      >
        {loading && <DataLoading message="Loading tasks..." className="!py-3" />}
        {!loading && focusTasks.length === 0 && (
          <p className="tm-caption italic text-center py-2">Nothing due today or overdue</p>
        )}
        {!loading &&
          focusTasks.map((task) => (
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

export default TodosTodayCard;
