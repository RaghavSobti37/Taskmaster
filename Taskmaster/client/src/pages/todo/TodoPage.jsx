import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useState, useMemo, lazy, Suspense, useEffect, useCallback } from 'react';
import { Search, ListTodo, AlertCircle, Clock, ClipboardCheck, Layers } from 'lucide-react';
import axios from 'axios';
import ListPageLayout from '../../components/ui/ListPageLayout';
import PageLoadGuard from '../../components/ui/PageLoadGuard';
import PageSkeleton from '../../components/ui/PageSkeleton';
import SearchInput from '../../components/ui/SearchInput';
import ListCard from '../../components/ui/ListCard';
import { UserLabel } from '../../components/ui/UserAvatar';
import { StatusBadge, Banner, TablePagination, EmptyState, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import { DataLoading } from '../../components/ui/DataLoading';
import { filterProjectsByWorkspace } from '../../components/forms/WorkspaceProjectFields';
import { normalizeTaskCategory, getPriorityBadgeVariant, STATUS_FILTER_OPTIONS, PRIORITY_FILTER_OPTIONS, taskCategoryLabel } from '../../constants/taskOptions';
import { useTaskCategoryOptions } from '../../hooks/useTaskCategoryOptions';
import { formatTaskStatus, formatTaskPriority } from '../../utils/displayLabels';
import { useAuth } from '../../contexts/AuthContext';
import { useTodoTasks, useProjects, useWorkspaces, useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';
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
import CompletedTaskRollbackButton from '../../components/tasks/CompletedTaskRollbackButton';
import { updateAllTaskQueries } from '../../utils/taskCache';
import { isPendingTask } from '../../utils/pendingTask';
import { TaskTableRowSkeleton } from '../../components/tasks/TaskPendingSkeleton';
import { Circle, CheckCircle2, ArrowUp, ArrowDown } from 'lucide-react';
import MentionTitle from '../../components/mentions/MentionTitle';
import TaskMentionBadge from '../../components/tasks/TaskMentionBadge';
import FlashHighlightListener from '../../components/ui/FlashHighlight';
import VirtualTaskList from '../../components/tasks/VirtualTaskList';
import { useDebounce } from '../../hooks/useDebounce';
import { buildTodoActiveFilterChips } from '../../utils/activeFilterChips';
import { countActiveFilters } from '../../components/ui/selectionFilterUtils';

const TODO_FILTERS_KEY = 'todo-filters';
const DEFAULT_PAGE_SIZE = 10;
const COMPLETED_PAGE_SIZE_DEFAULT = 10;

const loadTodoFilters = () => {
  try {
    const raw = localStorage.getItem(TODO_FILTERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
};

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
  const savedFilters = useMemo(() => loadTodoFilters(), []);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useSystemToast();
  const [search, setSearch] = useState(savedFilters?.search || '');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState(savedFilters?.statusFilter || 'all');
  const includeOldCompleted = statusFilter === 'done' || debouncedSearch.trim().length > 0;
  const useSplitCompletedPagination = !includeOldCompleted && statusFilter !== 'done';
  const [priorityFilter, setPriorityFilter] = useState(savedFilters?.priorityFilter || 'all');
  const [typeFilter, setTypeFilter] = useState(savedFilters?.typeFilter || 'all');
  const [workspaceFilter, setWorkspaceFilter] = useState(savedFilters?.workspaceFilter || 'all');
  const [projectFilter, setProjectFilter] = useState(savedFilters?.projectFilter || 'all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(savedFilters?.pageSize || DEFAULT_PAGE_SIZE);
  const [completedPage, setCompletedPage] = useState(1);
  const [completedPageSize, setCompletedPageSize] = useState(COMPLETED_PAGE_SIZE_DEFAULT);
  const [sortConfig, setSortConfig] = useState(savedFilters?.sortConfig || { field: 'dueDate', order: 'asc' });
  const [statFilter, setStatFilter] = useState(savedFilters?.statFilter ?? null);

  const todoParams = useMemo(() => ({
    page,
    limit: pageSize,
    search: debouncedSearch.trim() || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    projectId: projectFilter !== 'all' ? projectFilter : undefined,
    workspace: workspaceFilter !== 'all' ? workspaceFilter : undefined,
    statFilter: statFilter || undefined,
    sort: sortConfig.field || 'dueDate',
    order: sortConfig.order || 'asc',
    ...(includeOldCompleted ? { includeOldCompleted: '1' } : {}),
    ...(useSplitCompletedPagination
      ? { completedPage, completedLimit: completedPageSize }
      : {}),
  }), [
    page, pageSize, debouncedSearch, statusFilter, priorityFilter, typeFilter,
    projectFilter, workspaceFilter, statFilter, sortConfig, includeOldCompleted,
    useSplitCompletedPagination, completedPage, completedPageSize,
  ]);

  const { data, isLoading, isError, error, refetch } = useTodoTasks(todoParams, user?._id);
  const tasks = data?.tasks || [];
  const taskIndicators = data?.stats || { open: 0, overdue: 0, today: 0, inReview: 0 };
  const totalPages = data?.pages || 1;
  const totalItems = data?.total || 0;

  const deferTodoFilters = useDeferredQueryEnabled(!isLoading);
  const { data: projects = [] } = useProjects(deferTodoFilters);
  const { data: workspaces = [] } = useWorkspaces(deferTodoFilters);
  const { data: users = [] } = useUserDirectory(deferTodoFilters);
  const { options: categoryOptions } = useTaskCategoryOptions();

  const [selectedTask, setSelectedTask] = useState(null);
  const [taskToComplete, setTaskToComplete] = useState(null);
  const [completionSubmitForReview, setCompletionSubmitForReview] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState(null);

  useEffect(() => {
    setPage(1);
    setCompletedPage(1);
  }, [debouncedSearch, statusFilter, priorityFilter, typeFilter, workspaceFilter, projectFilter, statFilter]);

  useEffect(() => {
    try {
      localStorage.setItem(
        TODO_FILTERS_KEY,
        JSON.stringify({
          search,
          statusFilter,
          priorityFilter,
          typeFilter,
          workspaceFilter,
          projectFilter,
          sortConfig,
          statFilter,
          pageSize,
        })
      );
    } catch {
      /* ignore */
    }
  }, [search, statusFilter, priorityFilter, typeFilter, workspaceFilter, projectFilter, sortConfig, statFilter, pageSize]);

  const toggleSort = (field) => {
    setSortConfig((prev) => {
      if (prev.field !== field) return { field, order: 'asc' };
      if (prev.order === 'asc') return { field, order: 'desc' };
      return { field: 'dueDate', order: 'asc' };
    });
    setPage(1);
  };

  const SortHeader = ({ field, label }) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1 hover:text-[var(--color-action-primary)] transition-colors"
      title={
        sortConfig.field === field
          ? `Sorted ${sortConfig.order === 'asc' ? 'ascending' : 'descending'} — click to change`
          : `Sort by ${label}`
      }
    >
      {label}
      {sortConfig.field === field && (
        sortConfig.order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
      )}
    </button>
  );

  const typeOptions = useMemo(
    () => [{ value: 'all', label: 'All categories' }, ...categoryOptions],
    [categoryOptions]
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

  const activeFilterChips = useMemo(
    () => buildTodoActiveFilterChips(
      {
        search,
        statusFilter,
        priorityFilter,
        typeFilter,
        workspaceFilter,
        projectFilter,
        statFilter,
      },
      {
        typeOptions,
        workspaceOptions: workspaceFilterOptions,
        projectOptions: projectFilterOptions,
      }
    ),
    [
      search,
      statusFilter,
      priorityFilter,
      typeFilter,
      workspaceFilter,
      projectFilter,
      statFilter,
      typeOptions,
      workspaceFilterOptions,
      projectFilterOptions,
    ]
  );

  const handleClearAllFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setTypeFilter('all');
    setWorkspaceFilter('all');
    setProjectFilter('all');
    setStatFilter(null);
    setPage(1);
  }, []);

  const handleActiveFilterRemove = useCallback((id) => {
    switch (id) {
      case 'search':
        setSearch('');
        break;
      case 'statFilter':
        setStatFilter(null);
        break;
      case 'statusFilter':
        setStatusFilter('all');
        break;
      case 'priorityFilter':
        setPriorityFilter('all');
        break;
      case 'typeFilter':
        setTypeFilter('all');
        break;
      case 'workspaceFilter':
        setWorkspaceFilter('all');
        setProjectFilter('all');
        break;
      case 'projectFilter':
        setProjectFilter('all');
        break;
      default:
        break;
    }
    setPage(1);
  }, []);

  const todoFilterFields = useMemo(() => [
    {
      id: 'statusFilter',
      label: 'Status',
      type: 'radio',
      value: statusFilter,
      defaultValue: 'all',
      options: STATUS_FILTER_OPTIONS,
      onChange: setStatusFilter,
    },
    {
      id: 'priorityFilter',
      label: 'Priority',
      type: 'radio',
      value: priorityFilter,
      defaultValue: 'all',
      options: PRIORITY_FILTER_OPTIONS,
      onChange: setPriorityFilter,
    },
    {
      id: 'typeFilter',
      label: 'Category',
      type: 'radio',
      value: typeFilter,
      defaultValue: 'all',
      options: typeOptions,
      onChange: setTypeFilter,
    },
    {
      id: 'workspaceFilter',
      label: 'Workspace',
      type: 'searchable',
      value: workspaceFilter,
      defaultValue: 'all',
      options: workspaceFilterOptions,
      onChange: (value) => {
        setWorkspaceFilter(value);
        setProjectFilter('all');
      },
    },
    {
      id: 'projectFilter',
      label: 'Project',
      type: 'searchable',
      value: projectFilter,
      defaultValue: 'all',
      options: projectFilterOptions,
      onChange: setProjectFilter,
    },
  ], [
    statusFilter,
    priorityFilter,
    typeFilter,
    workspaceFilter,
    projectFilter,
    typeOptions,
    workspaceFilterOptions,
    projectFilterOptions,
  ]);

  const getWorkspaceRowProps = (task, isDone) => {
    const workspaceColor = resolveTaskWorkspaceColor(task, workspaces, projects);
    return {
      style: getTaskRowStyle(workspaceColor),
      className: isDone ? 'tm-task-row tm-task-row--completed' : 'tm-task-row',
    };
  };

  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const completedTotal = data?.completedTotal ?? doneTasks.length;
  const completedTotalPages = data?.completedPages ?? 1;
  const showCompletedSection = useSplitCompletedPagination
    ? completedTotal > 0 && !statFilter
    : doneTasks.length > 0;

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
      const toastMsg = taskCompletionToast(taskRes.data?.status, task.title);
      addToast({ ...toastMsg, module: MODULE.PROJECTS });
      updateAllTaskQueries(queryClient, (list) =>
        (list || []).map((t) => (t._id === task._id ? { ...t, ...taskRes.data } : t))
      );
      queryClient.invalidateQueries({ queryKey: ['tasks', 'todo'] });
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

  const renderDoneTaskCard = (task) => (
    <div
      key={task._id}
      className="tm-task-row tm-task-row--completed px-4 py-2 border-b border-[var(--color-bg-border)]"
    >
      <div className="flex items-center gap-2 min-w-0">
        <CompletedTaskRollbackButton task={task} user={user} onClick={setSelectedTask} />
        <MentionTitle
          text={task.title}
          className="text-sm text-[var(--color-text-muted)] line-through decoration-[var(--color-text-muted)]/50 block truncate min-w-0 flex-1"
          truncate
        />
      </div>
    </div>
  );

  const renderDoneRow = (task) => (
    <tr
      key={task._id}
      className="tm-task-row tm-task-row--completed border-b border-[var(--color-bg-border)]"
    >
      <td className="px-4 py-1.5 w-10">
        <CompletedTaskRollbackButton task={task} user={user} onClick={setSelectedTask} />
      </td>
      <td colSpan={6} className="px-4 py-1.5">
        <MentionTitle
          text={task.title}
          className="text-sm text-[var(--color-text-muted)] line-through decoration-[var(--color-text-muted)]/50 truncate block"
          truncate
        />
      </td>
    </tr>
  );

  const renderTaskStatusCell = (task) => {
    if (task.status === 'in-review') {
      return <StatusBadge status="advisory">In review</StatusBadge>;
    }
    return <StatusBadge status={task.status}>{formatTaskStatus(task?.status)}</StatusBadge>;
  };

  const renderTaskPriorityCell = (task) => (
    <StatusBadge status={getPriorityBadgeVariant(task.priority)}>{formatTaskPriority(task?.priority)}</StatusBadge>
  );

  const renderTaskCard = (task) => {
    if (completingTaskId === task._id || isPendingTask(task) || task._updating) {
      return <div key={task?._id} className="p-4"><DataLoading /></div>;
    }
    if (task.status === 'done') return renderDoneTaskCard(task);
    const isDone = task.status === 'done';
    const isInReview = task.status === 'in-review';
    const assignerUser = resolveDirectoryUser(getTaskAssignedBy(task), users);
    const projectName = task.projectId?.name || projects.find((p) => p._id === (task.projectId?._id || task.projectId))?.name;
    const overdue = isDueOverdue(task);
    const dueRaw = task.dueDate || task.scheduleDate;
    const rowProps = getWorkspaceRowProps(task, isDone);

    return (
      <ListCard
        key={task._id}
        onClick={() => setSelectedTask(task)}
        style={rowProps.style}
        className={rowProps.className}
        primary={(
          <div className="flex items-start gap-2 min-w-0">
            <button
              type="button"
              className="mt-0.5 shrink-0"
              onClick={(e) => { e.stopPropagation(); if (!isDone && !isInReview) handleCompleteRequest(task); }}
              aria-label={isDone ? 'Completed' : 'Mark complete'}
            >
              {isDone ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} className="text-[var(--color-text-muted)]" />}
            </button>
            <div className="min-w-0 flex-1">
              <MentionTitle text={task.title} className="text-sm font-bold truncate block" truncate />
              <p className="text-[10px] text-[var(--color-text-muted)] truncate">{projectName || task.workspace}</p>
            </div>
            <TaskMentionBadge count={task.unreadMentions} />
          </div>
        )}
        secondary={(
          <div className="flex flex-wrap gap-2 mt-2">
            {renderTaskStatusCell(task)}
            {renderTaskPriorityCell(task)}
            {assignerUser && <UserLabel user={assignerUser} size="xs" />}
            <span className="text-[10px] text-[var(--color-text-muted)]">{formatDueDate(dueRaw)}{overdue && !isDone ? ' · Overdue' : ''}</span>
          </div>
        )}
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
    const overdue = isDueOverdue(task);
    const dueRaw = task.dueDate || task.scheduleDate;
    const rowProps = getWorkspaceRowProps(task, isDone);

    return (
      <tr
        key={task._id}
        className={`${rowProps.className} hover:opacity-95 cursor-pointer transition-colors`}
        style={rowProps.style}
        onClick={() => setSelectedTask(task)}
      >
        <td className="px-4 py-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (!isDone && !isInReview) handleCompleteRequest(task); }}
            aria-label={isDone ? 'Completed' : 'Mark complete'}
          >
            {isDone ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-[var(--color-text-muted)]" />}
          </button>
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <MentionTitle text={task.title} className="text-sm font-bold truncate" truncate />
            <TaskMentionBadge count={task.unreadMentions} />
          </div>
        </td>
        <td className="px-4 py-2 text-xs">{taskCategoryLabel(normalizeTaskCategory(task.type))}</td>
        <td className="px-4 py-2">
          {assignerUser ? (
            <UserLabel user={assignerUser} size="xs" nameClassName="text-xs font-bold text-[var(--color-text-primary)] truncate" />
          ) : (
            <span className="text-xs text-[var(--color-text-muted)]">—</span>
          )}
        </td>
        <td className="px-4 py-2">{renderTaskStatusCell(task)}</td>
        <td className="px-4 py-2">{renderTaskPriorityCell(task)}</td>
        <td className="px-4 py-2">
          {overdue && dueRaw ? (
            <div className="flex flex-col items-start gap-1">
              <StatusBadge status="overdue">Overdue</StatusBadge>
              <span className="text-xs text-[var(--color-text-muted)]">{formatDisplayDateShort(startOfDay(new Date(dueRaw)))}</span>
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
            onClick: () => { setStatFilter(statFilter === 'open' ? null : 'open'); setPage(1); },
            active: statFilter === 'open',
          },
          {
            id: 'overdue',
            label: 'Overdue',
            value: taskIndicators.overdue,
            icon: AlertCircle,
            variant: 'rose',
            info: 'Open tasks past their due date.',
            onClick: () => { setStatFilter(statFilter === 'overdue' ? null : 'overdue'); setPage(1); },
            active: statFilter === 'overdue',
          },
          {
            id: 'today',
            label: 'Due Today',
            value: taskIndicators.today,
            icon: Clock,
            variant: 'apricot',
            info: 'Open tasks due today.',
            onClick: () => { setStatFilter(statFilter === 'today' ? null : 'today'); setPage(1); },
            active: statFilter === 'today',
          },
          {
            id: 'review',
            label: 'In Review',
            value: taskIndicators.inReview,
            icon: ClipboardCheck,
            variant: 'mint',
            info: 'Tasks you submitted that are waiting for reviewer approval.',
            onClick: () => { setStatFilter(statFilter === 'in-review' ? null : 'in-review'); setPage(1); },
            active: statFilter === 'in-review',
          },
        ],
      }}
      mobileFilterCount={
        countActiveFilters(todoFilterFields) + (statFilter ? 1 : 0) + (search.trim() ? 1 : 0)
      }
      toolbarFill
      filterFields={todoFilterFields}
      filterSheetTitle="Task filters"
      activeFilterChips={activeFilterChips}
      onActiveFilterRemove={handleActiveFilterRemove}
      onActiveFiltersClear={handleClearAllFilters}
      searchBar={(
        <SearchInput
          variant="toolbar"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-full"
        />
      )}
    >
      {statFilter === 'in-review' && (
        <Banner
          variant="advisory"
          message="Tasks you submitted are awaiting reviewer approval."
          className="mb-4"
        />
      )}
      {isError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(error, 'Failed to load tasks')}
          onRetry={() => refetch()}
        />
      )}
      <FlashHighlightListener />

      <div className="lg:hidden space-y-3">
        {!isLoading && tasks.length === 0 && (
          <EmptyState
            title="No tasks match filters"
            description="Try clearing filters or create a task from the + menu."
          />
        )}
        {activeTasks.length > 20 ? (
          <VirtualTaskList items={activeTasks} renderItem={(task) => renderTaskCard(task)} />
        ) : (
          activeTasks.map(renderTaskCard)
        )}
        {showCompletedSection && (
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] px-1">
            Completed ({completedTotal})
          </p>
        )}
        {showCompletedSection && (doneTasks.length > 20 ? (
          <VirtualTaskList items={doneTasks} renderItem={(task) => renderDoneTaskCard(task)} />
        ) : (
          doneTasks.map(renderDoneTaskCard)
        ))}
      </div>

      <div className="hidden lg:block space-y-6">
        {statusFilter !== 'done' && (
        <div className="overflow-hidden border-t border-[var(--color-bg-border)]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--color-bg-border)] text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                <th className="px-4 py-3 w-10" />
                <th className="px-4 py-3"><SortHeader field="title" label="Task" /></th>
                <th className="px-4 py-3"><SortHeader field="type" label="Type" /></th>
                <th className="px-4 py-3">Assigned by</th>
                <th className="px-4 py-3"><SortHeader field="status" label="Status" /></th>
                <th className="px-4 py-3"><SortHeader field="priority" label="Priority" /></th>
                <th className="px-4 py-3"><SortHeader field="dueDate" label="Due" /></th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && statusFilter !== 'done' && activeTasks.length === 0 && !showCompletedSection && (
                <tr><td colSpan={7} className="p-12 text-center text-sm text-[var(--color-text-muted)] italic">No tasks match filters</td></tr>
              )}
              {!isLoading && statusFilter !== 'done' && activeTasks.length === 0 && showCompletedSection && (
                <tr><td colSpan={7} className="p-10 text-center text-sm text-[var(--color-text-muted)] italic">No open tasks — completed tasks are listed below.</td></tr>
              )}
              {statusFilter !== 'done' && activeTasks.map(renderRow)}
            </tbody>
          </table>
          {totalItems > 0 && (
            <TablePagination
              pageSize={pageSize}
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              rowCount={activeTasks.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          )}
        </div>
        )}

        {showCompletedSection && (
          <div className="overflow-hidden border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
            <div className="px-4 py-2 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/40">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Completed Tasks ({completedTotal})
              </h3>
            </div>
            <table className="w-full text-left">
              <tbody>
                {doneTasks.map(renderDoneRow)}
              </tbody>
            </table>
            {useSplitCompletedPagination && (
              <TablePagination
                pageSize={completedPageSize}
                currentPage={Math.min(completedPage, completedTotalPages)}
                totalPages={completedTotalPages}
                totalItems={completedTotal}
                rowCount={doneTasks.length}
                onPageChange={setCompletedPage}
                onPageSizeChange={(size) => {
                  setCompletedPageSize(size);
                  setCompletedPage(1);
                }}
              />
            )}
          </div>
        )}

        {statusFilter === 'done' && !isLoading && doneTasks.length === 0 && (
          <div className="p-12 text-center text-sm text-[var(--color-text-muted)] italic border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
            No completed tasks match filters
          </div>
        )}

        {statusFilter === 'done' && totalItems > 0 && (
          <TablePagination
            pageSize={pageSize}
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            rowCount={doneTasks.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        )}
      </div>

      {(selectedTask || taskToComplete) && (
        <Suspense fallback={null}>
          <TaskDetailModal
            isOpen={!!selectedTask}
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onTaskUpdated={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
            onFinishRequest={handleCompleteRequest}
          />
          <TaskCompletionModal task={taskToComplete} isOpen={!!taskToComplete} onClose={() => setTaskToComplete(null)} onSubmit={handleCompleteSubmit} submitForReview={completionSubmitForReview} />
        </Suspense>
      )}
    </ListPageLayout>
    </PageLoadGuard>
  );
};

export default TodoPage;
