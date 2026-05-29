import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTodo } from 'lucide-react';
import { Card, Badge, DataLoading } from '../ui';
import { isToday, startOfDay } from 'date-fns';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { getTaskWorkspace, getWorkspaceColor } from '../../utils/workspaceColors';
import DashboardTaskRow from './DashboardTaskRow';

const getTaskDay = (task) => {
  const raw = task.scheduleDate || task.dueDate;
  if (!raw) return null;
  return startOfDay(new Date(raw));
};

const TodosTodayCard = ({ tasks = [], loading, onComplete, onOpenTodo }) => {
  const navigate = useNavigate();
  const { data: workspaces = [] } = useWorkspaces();

  const todayTasks = tasks.filter((t) => {
    if (t.status === 'done') return false;
    const day = getTaskDay(t);
    return day && isToday(day);
  });

  const openTask = (task) => {
    if (onOpenTodo) onOpenTodo(task);
    else navigate('/todo');
  };

  return (
    <Card className="p-0 flex flex-col shadow-md overflow-hidden flex-1 min-h-0">
      <button
        type="button"
        onClick={() => navigate('/todo')}
        className="p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between w-full text-left hover:bg-[var(--color-bg-border)]/30 transition-colors shrink-0"
      >
        <h4 className="tm-section-label flex items-center gap-2 text-[var(--color-text-primary)]">
          <ListTodo size={16} className="text-[var(--color-brand-teal)]" /> Todos for Today
        </h4>
        <Badge variant="info">{todayTasks.length}</Badge>
      </button>
      <div className="p-3 space-y-2 flex-1 min-h-0 overflow-y-auto">
        {loading && <DataLoading message="Loading tasks..." className="!py-6" />}
        {!loading && todayTasks.length === 0 && (
          <p className="tm-caption italic text-center py-8">Nothing due today</p>
        )}
        {!loading &&
          todayTasks.map((task) => (
            <DashboardTaskRow
              key={task._id}
              task={task}
              workspaceColor={getWorkspaceColor(getTaskWorkspace(task), workspaces)}
              onComplete={onComplete}
              onOpen={openTask}
            />
          ))}
      </div>
    </Card>
  );
};

export default TodosTodayCard;
