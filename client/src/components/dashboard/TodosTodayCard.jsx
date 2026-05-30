import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTodo, ArrowDown, ArrowUp } from 'lucide-react';
import { Card, Badge, DataLoading, Button } from '../ui';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { resolveTaskWorkspaceColor } from '../../utils/workspaceColors';
import {
  filterTodayTasks,
  filterOverdueTasks,
  sortTasksByPriority,
  sortTasksByDate,
} from '../../utils/dashboardTasks';
import DashboardTaskRow from './DashboardTaskRow';

const SortToggle = ({ direction, onToggle, label }) => (
  <Button
    type="button"
    variant="ghost"
    size="xs"
    onClick={onToggle}
    className="!px-2 !py-1 gap-1 shrink-0"
    title={`Sort ${label} ${direction === 'asc' ? 'ascending' : 'descending'}`}
    aria-label={`Sort ${label} ${direction === 'asc' ? 'ascending' : 'descending'}`}
  >
    {direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
    <span className="text-[9px] font-bold uppercase">{direction === 'asc' ? 'Asc' : 'Desc'}</span>
  </Button>
);

const TaskSection = ({
  title,
  tasks,
  badgeVariant,
  sortDirection,
  onSortToggle,
  sortLabel,
  loading,
  emptyMessage,
  workspaces,
  projects,
  onComplete,
  onOpen,
  completingTaskId,
}) => (
  <div className="flex flex-col">
    <div className="px-4 py-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/60 flex items-center justify-between gap-2">
      <h5 className="tm-section-label text-[var(--color-text-primary)]">{title}</h5>
      <div className="flex items-center gap-2 shrink-0">
        <SortToggle direction={sortDirection} onToggle={onSortToggle} label={sortLabel} />
        <Badge variant={badgeVariant}>{tasks.length}</Badge>
      </div>
    </div>
    <div
      className={`p-3 space-y-2 ${
        tasks.length > 5 ? 'max-h-[min(40vh,320px)] overflow-y-auto custom-scrollbar' : ''
      }`}
    >
      {loading && <DataLoading message="Loading tasks..." className="!py-3" />}
      {!loading && tasks.length === 0 && (
        <p className="tm-caption italic text-center py-2">{emptyMessage}</p>
      )}
      {!loading &&
        tasks.map((task) => (
          <DashboardTaskRow
            key={task._id}
            task={task}
            workspaceColor={resolveTaskWorkspaceColor(task, workspaces, projects)}
            onComplete={onComplete}
            onOpen={onOpen}
            isCompleting={completingTaskId === task._id}
          />
        ))}
    </div>
  </div>
);

const TodosTodayCard = ({ tasks = [], projects = [], loading, onComplete, onOpenTodo, completingTaskId = null }) => {
  const navigate = useNavigate();
  const { data: workspaces = [] } = useWorkspaces();
  const [overdueSort, setOverdueSort] = useState('desc');
  const [todaySort, setTodaySort] = useState('asc');

  const overdueTasks = useMemo(
    () => sortTasksByPriority(filterOverdueTasks(tasks), overdueSort),
    [tasks, overdueSort]
  );

  const todayTasks = useMemo(
    () => sortTasksByDate(filterTodayTasks(tasks), todaySort),
    [tasks, todaySort]
  );

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
        <h4 className="tm-section-label flex items-center gap-2 text-[var(--color-text-primary)]">
          <ListTodo size={16} className="text-[var(--color-brand-teal)]" /> Todos — Today & Overdue
        </h4>
        <Badge variant={overdueTasks.length > 0 ? 'overdue' : 'info'}>
          {overdueTasks.length + todayTasks.length}
        </Badge>
      </button>

      <TaskSection
        title="Overdue"
        tasks={overdueTasks}
        badgeVariant={overdueTasks.length > 0 ? 'overdue' : 'info'}
        sortDirection={overdueSort}
        onSortToggle={() => setOverdueSort((d) => (d === 'desc' ? 'asc' : 'desc'))}
        sortLabel="overdue by priority"
        loading={loading}
        emptyMessage="No overdue tasks"
        workspaces={workspaces}
        projects={projects}
        onComplete={onComplete}
        onOpen={openTask}
        completingTaskId={completingTaskId}
      />

      <TaskSection
        title="Today"
        tasks={todayTasks}
        badgeVariant="info"
        sortDirection={todaySort}
        onSortToggle={() => setTodaySort((d) => (d === 'asc' ? 'desc' : 'asc'))}
        sortLabel="today by date"
        loading={loading}
        emptyMessage="Nothing due today"
        workspaces={workspaces}
        projects={projects}
        onComplete={onComplete}
        onOpen={openTask}
        completingTaskId={completingTaskId}
      />
    </Card>
  );
};

export default TodosTodayCard;
