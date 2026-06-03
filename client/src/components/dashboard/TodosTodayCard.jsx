import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTodo, ArrowDown, ArrowUp } from 'lucide-react';
import { DashboardWidgetShell, DataLoading, Button, TimeframeFilter, CountBadge } from '../ui';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { resolveTaskWorkspaceColor } from '../../utils/workspaceColors';
import { filterTasksByTimeframe, sortTasksByDate } from '../../utils/dashboardTasks';
import DashboardTaskRow from './DashboardTaskRow';

const SortToggle = ({ direction, onToggle, label }) => (
  <Button
    type="button"
    variant="ghost"
    size="xs"
    onClick={onToggle}
    className="!px-2 !py-1 gap-1 shrink-0"
    title={`Sort ${label} ${direction === 'asc' ? 'ascending' : 'descending'}`}
  >
    {direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
    <span className="text-[9px] font-bold uppercase">{direction === 'asc' ? 'Asc' : 'Desc'}</span>
  </Button>
);

const TodosTodayCard = ({ tasks = [], projects = [], loading, onComplete, onOpenTodo, completingTaskId = null }) => {
  const navigate = useNavigate();
  const { data: workspaces = [] } = useWorkspaces();
  const [todaySort, setTodaySort] = useState('asc');
  const [timeframe, setTimeframe] = useState('1d');

  const todayTasks = useMemo(
    () => sortTasksByDate(filterTasksByTimeframe(tasks, timeframe), todaySort),
    [tasks, todaySort, timeframe]
  );

  const openTask = (task) => {
    if (onOpenTodo) onOpenTodo(task);
    else navigate('/todo');
  };

  return (
    <DashboardWidgetShell
      className="h-full overflow-hidden"
      bodyClassName="p-0 flex flex-col flex-1 min-h-0"
      title={
        <button
          type="button"
          onClick={() => navigate('/todo')}
          className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
        >
          Tasks ({timeframe})
        </button>
      }
      icon={ListTodo}
      actions={
        <>
          <TimeframeFilter value={timeframe} onChange={setTimeframe} />
          <SortToggle direction={todaySort} onToggle={() => setTodaySort((d) => (d === 'asc' ? 'desc' : 'asc'))} label="date" />
          <CountBadge count={todayTasks.length} size="sm" variant="info" />
        </>
      }
    >
      <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
        {loading && <DataLoading message="Loading today's tasks..." className="!py-3" />}
        {!loading && todayTasks.length === 0 && (
          <p className="tm-caption italic text-center py-4">Nothing due today. Great job!</p>
        )}
        {!loading && todayTasks.map((task) => (
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

export default TodosTodayCard;
