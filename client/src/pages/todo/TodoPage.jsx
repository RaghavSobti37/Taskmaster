import React, { useState, useMemo, lazy, Suspense } from 'react';
import { Search, ListTodo, AlertCircle, Clock, ClipboardCheck, Layers } from 'lucide-react';
import axios from 'axios';
import ListPageLayout from '../../components/ui/ListPageLayout';
import PageLoadGuard from '../../components/ui/PageLoadGuard';
import PageSkeleton from '../../components/ui/PageSkeleton';
import SearchInput from '../../components/ui/SearchInput';
import ListCard from '../../components/ui/ListCard';
import { UserLabel } from '../../components/ui/UserAvatar';
import { Badge } from '../../components/ui/primitives';
import { DataLoading } from '../../components/ui/DataLoading';
import StatusSelect from '../../components/forms/StatusSelect';
import PrioritySelect from '../../components/forms/PrioritySelect';
import NexusDropdown from '../../components/ui/NexusDropdown';
import { filterProjectsByWorkspace } from '../../components/forms/WorkspaceProjectFields';
import { TASK_CATEGORY_OPTIONS, normalizeTaskCategory, taskCategoryLabel, getPriorityBadgeVariant } from '../../constants/taskOptions';
import { formatTaskStatus, formatTaskPriority } from '../../utils/displayLabels';
import { useAuth } from '../../contexts/AuthContext';
import { useTasks, useProjects, useWorkspaces, useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { format, isBefore, startOfDay } from 'date-fns';
import { formatDueDate } from '../../utils/formatDueDate';
import { resolveTaskWorkspaceColor, getTaskRowStyle } from '../../utils/workspaceColors';
const TaskDetailModal = lazy(() => import('../../components/TaskDetailModal'));
const TaskCompletionModal = lazy(() => import('../../components/TaskCompletionModal'));
import { useQueryClient } from '@tanstack/react-query';
import { useSystemToast } from '../../lib/systemLogBridge';
import { MODULE } from '../../lib/systemLogContract';
import { suppressAutoToasts, AXIOS_SKIP_TOAST } from '../../lib/notifications';
import {
  taskCompletionToast,
  canMarkTaskComplete,
  pendingReviewToast,
  awaitingAssigneeToast,
  normalizeCompletionHours,
} from '../../utils/taskCompletion';
import { getTaskAssignedBy, displayPersonName, resolveTaskFinishIntent } from '../../utils/taskReview';
import { updateAllTaskQueries } from '../../utils/taskCache';
import { isPendingTask } from '../../utils/pendingTask';
import { sortTasksByDueDate } from '../../utils/dashboardTasks';
import { TaskTableRowSkeleton } from '../../components/tasks/TaskPendingSkeleton';
import { Circle, CheckCircle2, ArrowUp, ArrowDown } from 'lucide-react';
import MentionTitle from '../../components/mentions/MentionTitle';
import FlashHighlightListener from '../../components/ui/FlashHighlight';
import { computeTaskIndicators } from '../../utils/taskIndicators';

function resolveDirectoryUser(person, users = []) {
  if (!person) return null;
  const id = typeof person === 'object' ? person._id || person.userId?._id || person.userId : person;
  const fromDir = id ? users.find((u) => String(u._id) === String(id)) : null;
  if (typeof person === 'object' && (person.name || person.avatar)) {
    return fromDir ? { ...fromDir, ...person, name: person.name || fromDir.name, avatar: person.avatar || fromDir.avatar } : person;
  }
  return fromDir || null;
}

function isDueOverdue(task) {
  const raw = task.dueDate || task.scheduleDate;
  if (!raw) return false;
  const d = startOfDay(new Date(raw));
  if (Number.isNaN(d.getTime())) return false;
  return isBefore(d, startOfDay(new Date()));
}

const TodoPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useSystemToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const includeOldCompleted = statusFilter === 'done' || search.trim().length > 0;
  const { data: tasks = [], isLoading } = useTasks(user?._id, { includeOldCompleted });
  const { data: projects = [] } = useProjects();
  const { data: workspaces = [] } = useWorkspaces();
  const { data: users = [] } = useUserDirectory();
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [workspaceFilter, setWorkspaceFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskToComplete, setTaskToComplete] = useState(null);
  const [completionSubmitForReview, setCompletionSubmitForReview] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [dueDateSort, setDueDateSort] = useState('asc');
  const [statFilter, setStatFilter] = useState(null);

  const taskIndicators = useMemo(() => computeTaskIndicators(tasks), [tasks]);

  const typeOptions = useMemo(
    () => [{ value: 'all', label: 'All categories' }, ...TASK_CATEGORY_OPTIONS],
    []
  );

  const workspaceFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All workspaces' },
      ...workspaces.map((w) => ({ value: w.name, label: w.name })),
    ],
    [workspaces]
  );

  const projectFilterOptions = useMemo(() => [
    { value: 'all', label: 'All projects' },
    ...filterProjectsByWorkspace(projects, workspaceFilter).map((p) => ({ value: p._id, label: p.name }))
  ], [projects, workspaceFilter]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      const matchesType = typeFilter === 'all' || normalizeTaskCategory(t.type) === typeFilter;
      const pid = t.projectId?._id || t.projectId;
      const matchesProject = projectFilter === 'all' || pid?.toString() === projectFilter;
      let matchesStat = true;
      if (statFilter === 'overdue') matchesStat = isDueOverdue(t) && t.status !== 'done';
      else if (statFilter === 'today') {
        const raw = t.dueDate || t.scheduleDate;
        if (!raw || t.status === 'done') matchesStat = false;
        else {
          const d = startOfDay(new Date(raw));
          matchesStat = !Number.isNaN(d.getTime()) && d.getTime() === startOfDay(new Date()).getTime();
        }
      } else if (statFilter === 'in-review') matchesStat = t.status === 'in-review';
      else if (statFilter === 'open') matchesStat = t.status !== 'done';
      return matchesSearch && matchesStatus && matchesPriority && matchesType && matchesProject && matchesStat;
    });
  }, [tasks, search, statusFilter, priorityFilter, typeFilter, projectFilter, statFilter]);

  const sortedFiltered = useMemo(
    () => sortTasksByDueDate(filtered, dueDateSort),
    [filtered, dueDateSort]
  );

  const activeTasks = sortedFiltered.filter((t) => t.status !== 'done');
  const doneTasks = sortedFiltered.filter((t) => t.status === 'done');

  const handleCompleteRequest = (task) => {
    const intent = resolveTaskFinishIntent(task, user, projects, users);
    if (intent === 'approve') return;
    if (intent === 'awaiting_assignee') {
      addToast({ ...awaitingAssigneeToast(task.title), module: MODULE.PROJECTS });
      return;
    }
    if (intent === 'awaiting_review' || !canMarkTaskComplete(task)) {
      if (task?.status === 'in-review') {
        addToast({ ...pendingReviewToast(task.title), module: MODULE.PROJECTS });
      }
      return;
    }
    setCompletionSubmitForReview(intent === 'submit_review');
    setTaskToComplete(task);
  };

  const handleCompleteSubmit = async (task, hours) => {
    suppressAutoToasts(5000);
    setCompletingTaskId(task._id);
    setTaskToComplete(null);
    try {
      const taskRes = await axios.put(
        `/api/tasks/${task?._id}`,
        { status: 'done', actualHours: normalizeCompletionHours(task.actualHours, hours) },
        AXIOS_SKIP_TOAST
      );
      const toast = taskCompletionToast(taskRes.data?.status, task.title);
      addToast({ ...toast, module: MODULE.PROJECTS });
      updateAllTaskQueries(queryClient, (tasks) =>
        (tasks || []).map((t) => (t._id === task._id ? { ...t, ...taskRes.data } : t))
      );
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err) {
      addToast({
        title: 'Error',
        message: err.response?.data?.error || err.response?.data?.message || 'Failed',
        type: 'error',
        module: MODULE.PROJECTS,
      });
    } finally {
      setCompletingTaskId(null);
    }
  };

  const renderTaskCard = (task) => {
    if (completingTaskId === task._id || isPendingTask(task) || task._updating) {
      return <div key={task?._id} className="p-4"><DataLoading /></div>;
    }
    const isDone = task.status === 'done';
    const isInReview = task.status === 'in-review';
    const assignerUser = resolveDirectoryUser(getTaskAssignedBy(task), users);
    const projectName = task.projectId?.name || projects.find((p) => p._id === (task.projectId?._id || task.projectId))?.name;
    const accent = resolveTaskWorkspaceColor(task, workspaces, projects);
    const dueRaw = task.dueDate || task.scheduleDate;
    const overdue = isDueOverdue(task);

    return (
      <ListCard
        key={task?._id}
        highlightId={task?._id}
        onClick={() => setSelectedTask(task)}
        className={`tm-task-row ${isDone ? 'opacity-60' : ''} ${isInReview ? 'ring-1 ring-amber-500/30' : ''}`}
        style={getTaskRowStyle(accent)}
        leading={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!isDone && !isInReview) handleCompleteRequest(task);
            }}
            disabled={isInReview}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center ${isDone ? 'text-emerald-500' : isInReview ? 'text-amber-500 opacity-60' : 'text-[var(--color-text-muted)]'}`}
            title={isInReview ? 'Awaiting reviewer approval' : isDone ? 'Completed' : 'Mark complete'}
          >
            {isDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}
          </button>
        }
        primary={
          <div className={`text-sm font-bold min-w-0 ${isDone ? 'line-through' : ''}`}>
            <MentionTitle text={task?.title} className="tm-task-title" truncate />
          </div>
        }
        trailing={
          overdue && dueRaw ? (
            <Badge variant="overdue">Overdue</Badge>
          ) : (
            <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{formatDueDate(dueRaw)}</span>
          )
        }
        secondary={projectName ? <p className="text-xs truncate text-[var(--color-text-muted)]">{projectName}</p> : null}
        meta={
          <>
            <Badge variant={isInReview ? 'warning' : 'todo'}>{isInReview ? 'Awaiting review' : formatTaskStatus(task?.status)}</Badge>
            <Badge variant={getPriorityBadgeVariant(task.priority)}>{formatTaskPriority(task?.priority)}</Badge>
            {task.type && (
              <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">{taskCategoryLabel(task.type)}</span>
            )}
            {assignerUser && (
              <UserLabel user={assignerUser} name={displayPersonName(assignerUser)} size="xs" nameClassName="text-xs truncate" />
            )}
          </>
        }
      />
    );
  };

  const renderRow = (task) => {
    if (completingTaskId === task._id || isPendingTask(task) || task._updating) {
      return <TaskTableRowSkeleton key={task?._id} colSpan={7} />;
    }
    const isDone = task.status === 'done';
    const isInReview = task.status === 'in-review';
    const assignerUser = resolveDirectoryUser(getTaskAssignedBy(task), users);
    const project = task.projectId?.name || projects.find((p) => p._id === (task.projectId?._id || task.projectId))?.name;
    const accent = resolveTaskWorkspaceColor(task, workspaces, projects);
    const dueRaw = task.dueDate || task.scheduleDate;
    const overdue = isDueOverdue(task);
    return (
      <tr
        key={task?._id}
        data-highlight-id={task?._id}
        className={`tm-task-row cursor-pointer ${isDone ? 'opacity-60' : ''} ${isInReview ? 'ring-1 ring-amber-500/30' : ''}`}
        style={getTaskRowStyle(accent)}
        onClick={() => setSelectedTask(task)}
      >
        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => (isDone || isInReview ? null : handleCompleteRequest(task))}
            disabled={isInReview}
            className={isDone ? 'text-emerald-500' : isInReview ? 'text-amber-500 opacity-60 cursor-not-allowed' : 'text-[var(--color-text-muted)] hover:text-emerald-500'}
            title={isInReview ? 'Awaiting reviewer approval' : isDone ? 'Completed' : 'Mark complete'}
          >
            {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          </button>
        </td>
        <td className="px-4 py-2 max-w-0 w-full">
          <div className={`text-sm font-bold min-w-0 ${isDone ? 'line-through' : ''}`}>
            <MentionTitle text={task?.title} className="tm-task-title" truncate />
          </div>
          {project && (
            <p className="tm-caption mt-0.5 truncate text-[var(--color-text-muted)]">{project}</p>
          )}
        </td>
        <td className="px-4 py-2 text-[10px] font-bold uppercase">{task.type ? taskCategoryLabel(task.type) : '—'}</td>
        <td className="px-4 py-2 min-w-[120px]">
          {assignerUser ? (
            <UserLabel
              user={assignerUser}
              name={displayPersonName(assignerUser)}
              size="xs"
              nameClassName="text-xs font-bold text-[var(--color-text-primary)] truncate"
            />
          ) : (
            <span className="text-xs text-[var(--color-text-muted)]">—</span>
          )}
        </td>
        <td className="px-4 py-2"><Badge variant={isInReview ? 'warning' : 'todo'}>{isInReview ? 'Awaiting review' : formatTaskStatus(task?.status)}</Badge></td>
        <td className="px-4 py-2"><Badge variant={getPriorityBadgeVariant(task.priority)}>{formatTaskPriority(task?.priority)}</Badge></td>
        <td className="px-4 py-2">
          {overdue && dueRaw ? (
            <div className="flex flex-col items-start gap-1">
              <Badge variant="overdue">Overdue</Badge>
              <span className="text-xs text-[var(--color-text-muted)]">{format(startOfDay(new Date(dueRaw)), 'MMM d')}</span>
            </div>
          ) : (
            <span className="text-xs">{formatDueDate(dueRaw)}</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <PageLoadGuard loading={isLoading && !tasks.length} skeleton={PageSkeleton} className="!py-4">
    <ListPageLayout
      containerClassName="!py-4"
      overview={{
        stats: [
          {
            id: 'open',
            label: 'Open Tasks',
            value: taskIndicators.open,
            icon: Layers,
            variant: 'info',
            info: 'Tasks assigned to you that are not marked done.',
            onClick: () => setStatFilter(statFilter === 'open' ? null : 'open'),
            active: statFilter === 'open',
          },
          {
            id: 'overdue',
            label: 'Overdue',
            value: taskIndicators.overdue,
            icon: AlertCircle,
            variant: 'rose',
            info: 'Open tasks past their due date.',
            onClick: () => setStatFilter(statFilter === 'overdue' ? null : 'overdue'),
            active: statFilter === 'overdue',
          },
          {
            id: 'today',
            label: 'Due Today',
            value: taskIndicators.today,
            icon: Clock,
            variant: 'apricot',
            info: 'Open tasks due today.',
            onClick: () => setStatFilter(statFilter === 'today' ? null : 'today'),
            active: statFilter === 'today',
          },
          {
            id: 'review',
            label: 'In Review',
            value: taskIndicators.inReview,
            icon: ClipboardCheck,
            variant: 'mint',
            info: 'Tasks you submitted that are waiting for reviewer approval.',
            onClick: () => setStatFilter(statFilter === 'in-review' ? null : 'in-review'),
            active: statFilter === 'in-review',
          },
        ],
      }}
      mobileFilterCount={
        [statusFilter, priorityFilter, typeFilter, workspaceFilter, projectFilter].filter((f) => f !== 'all').length
      }
      toolbar={
        <>
          <SearchInput
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <StatusSelect filterMode value={statusFilter} onChange={setStatusFilter} />
          <PrioritySelect filterMode value={priorityFilter} onChange={setPriorityFilter} />
          <NexusDropdown options={typeOptions} value={typeFilter} onChange={setTypeFilter} label="Category" placeholder="All categories" />
          <NexusDropdown
            label="Workspace"
            options={workspaceFilterOptions}
            value={workspaceFilter}
            onChange={(value) => {
              setWorkspaceFilter(value);
              setProjectFilter('all');
            }}
            searchable
          />
          <NexusDropdown label="Project" options={projectFilterOptions} value={projectFilter} onChange={setProjectFilter} searchable />
        </>
      }
    >
      <FlashHighlightListener />

      {/* Mobile: card list */}
      <div className="lg:hidden space-y-3">
        {isLoading && <DataLoading />}
        {!isLoading && filtered.length === 0 && (
          <p className="p-12 text-center text-sm text-[var(--color-text-muted)] italic">No tasks match filters</p>
        )}
        {activeTasks.map(renderTaskCard)}
        {activeTasks.length > 0 && doneTasks.length > 0 && (
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] px-1">
            Completed ({doneTasks.length})
          </p>
        )}
        {doneTasks.map(renderTaskCard)}
      </div>

      {/* Desktop: table */}
      <div className="overflow-hidden hidden lg:block border-t border-[var(--color-bg-border)]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--color-bg-border)] text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              <th className="px-4 py-3 w-10" />
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Assigned by</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setDueDateSort((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  className="inline-flex items-center gap-1 hover:text-[var(--color-action-primary)] transition-colors"
                  title={`Sort due date ${dueDateSort === 'asc' ? 'ascending' : 'descending'}`}
                >
                  Due
                  {dueDateSort === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7}><DataLoading /></td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="p-12 text-center text-sm text-[var(--color-text-muted)] italic">No tasks match filters</td></tr>
            )}
            {activeTasks.map(renderRow)}
            {activeTasks.length > 0 && doneTasks.length > 0 && (
              <tr className="border-b border-[var(--color-bg-border)]">
                <td colSpan={7} className="px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Completed ({doneTasks.length})</td>
              </tr>
            )}
            {doneTasks.map(renderRow)}
          </tbody>
        </table>
      </div>

      {(selectedTask || taskToComplete) && (
        <Suspense fallback={null}>
          <TaskDetailModal isOpen={!!selectedTask} task={selectedTask} onClose={() => setSelectedTask(null)} onTaskUpdated={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })} />
          <TaskCompletionModal task={taskToComplete} isOpen={!!taskToComplete} onClose={() => setTaskToComplete(null)} onSubmit={handleCompleteSubmit} submitForReview={completionSubmitForReview} />
        </Suspense>
      )}
    </ListPageLayout>
    </PageLoadGuard>
  );
};

export default TodoPage;


// Performance Optimization: useCallback(eventHandler) memoization guard
