import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import axios from 'axios';
import { PageContainer, Card, Badge, SearchInput, PageSkeleton, DataLoading } from '../../components/ui';
import StatusSelect from '../../components/forms/StatusSelect';
import PrioritySelect from '../../components/forms/PrioritySelect';
import NexusDropdown from '../../components/ui/NexusDropdown';
import { TASK_CATEGORY_OPTIONS, normalizeTaskCategory, taskCategoryLabel } from '../../constants/taskOptions';
import { useAuth } from '../../contexts/AuthContext';
import { useTasks, useProjects, useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { formatDueDate } from '../../utils/formatDueDate';
import { getTaskWorkspace, getWorkspaceColor } from '../../utils/workspaceColors';
import TaskDetailModal from '../../components/TaskDetailModal';
import TaskCompletionModal from '../../components/TaskCompletionModal';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../contexts/ToastContext';
import { Circle, CheckCircle2 } from 'lucide-react';
import FlashHighlightListener from '../../components/ui/FlashHighlight';

const TodoPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { data: tasks = [], isLoading } = useTasks(user?._id);
  const { data: projects = [] } = useProjects();
  const { data: workspaces = [] } = useWorkspaces();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskToComplete, setTaskToComplete] = useState(null);

  const typeOptions = useMemo(
    () => [{ value: 'all', label: 'All categories' }, ...TASK_CATEGORY_OPTIONS],
    []
  );

  const projectFilterOptions = useMemo(() => [
    { value: 'all', label: 'All projects' },
    ...projects.map((p) => ({ value: p._id, label: p.name }))
  ], [projects]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      const matchesType = typeFilter === 'all' || normalizeTaskCategory(t.type) === typeFilter;
      const pid = t.projectId?._id || t.projectId;
      const matchesProject = projectFilter === 'all' || pid?.toString() === projectFilter;
      return matchesSearch && matchesStatus && matchesPriority && matchesType && matchesProject;
    });
  }, [tasks, search, statusFilter, priorityFilter, typeFilter, projectFilter]);

  const activeTasks = filtered.filter((t) => t.status !== 'done');
  const doneTasks = filtered.filter((t) => t.status === 'done');

  const handleCompleteSubmit = async (task, hours) => {
    try {
      await axios.put(`/api/tasks/${task._id}`, { status: 'done', actualHours: (task.actualHours || 0) + hours });
      await axios.post('/api/logs', { action: 'TIME_LOG', targetType: 'Task', targetId: task._id, details: { hours, title: task.title } });
      addToast({ title: 'Task Finished', message: `Completed "${task.title}"`, type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setTaskToComplete(null);
    } catch (err) {
      addToast({ title: 'Error', message: err.response?.data?.error || 'Failed', type: 'error' });
    }
  };

  const renderRow = (task) => {
    const isDone = task.status === 'done';
    const project = task.projectId?.name || projects.find((p) => p._id === (task.projectId?._id || task.projectId))?.name;
    const accent = getWorkspaceColor(getTaskWorkspace(task), workspaces);
    return (
      <tr
        key={task._id}
        data-highlight-id={task._id}
        className={`hover:bg-[var(--color-bg-secondary)] cursor-pointer ${isDone ? 'opacity-60' : ''}`}
        style={{ borderLeft: `3px solid ${accent}` }}
        onClick={() => setSelectedTask(task)}
      >
        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => (isDone ? null : setTaskToComplete(task))}
            className={isDone ? 'text-emerald-500' : 'text-[var(--color-text-muted)] hover:text-emerald-500'}
          >
            {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          </button>
        </td>
        <td className="px-4 py-2">
          <p className={`text-sm font-bold ${isDone ? 'line-through' : ''}`}>{task.title}</p>
        </td>
        <td className="px-4 py-2 text-[10px] font-bold uppercase">{task.type ? taskCategoryLabel(task.type) : '—'}</td>
        <td className="px-4 py-2 text-[10px] font-bold uppercase truncate max-w-[120px]">{project || '—'}</td>
        <td className="px-4 py-2"><Badge variant="todo">{task.status}</Badge></td>
        <td className="px-4 py-2"><Badge variant="todo">{task.priority}</Badge></td>
        <td className="px-4 py-2 text-xs">{formatDueDate(task.dueDate || task.scheduleDate)}</td>
      </tr>
    );
  };

  if (isLoading && !tasks.length) {
    return (
      <PageContainer className="!py-4">
        <PageSkeleton />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="!py-4 !space-y-4">
      <FlashHighlightListener />

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end w-full">
        <div className="flex-1 min-w-[200px] w-full">
          <SearchInput placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <StatusSelect filterMode value={statusFilter} onChange={setStatusFilter} className="w-full sm:w-36" />
        <PrioritySelect filterMode value={priorityFilter} onChange={setPriorityFilter} className="w-full sm:w-36" />
        <NexusDropdown label="Category" options={typeOptions} value={typeFilter} onChange={setTypeFilter} className="w-full sm:w-40" />
        <NexusDropdown label="Project" options={projectFilterOptions} value={projectFilter} onChange={setProjectFilter} className="w-full sm:w-44" searchable />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                <th className="px-4 py-3 w-10" />
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-border)]">
              {isLoading && (
                <tr><td colSpan={7}><DataLoading /></td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="p-12 text-center text-sm text-[var(--color-text-muted)] italic">No tasks match filters</td></tr>
              )}
              {activeTasks.map(renderRow)}
              {activeTasks.length > 0 && doneTasks.length > 0 && (
                <tr className="bg-[var(--color-bg-secondary)]/50">
                  <td colSpan={7} className="px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Completed ({doneTasks.length})</td>
                </tr>
              )}
              {doneTasks.map(renderRow)}
            </tbody>
          </table>
        </div>
      </Card>

      <TaskDetailModal isOpen={!!selectedTask} task={selectedTask} onClose={() => setSelectedTask(null)} onTaskUpdated={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })} />
      <TaskCompletionModal task={taskToComplete} isOpen={!!taskToComplete} onClose={() => setTaskToComplete(null)} onSubmit={handleCompleteSubmit} />
    </PageContainer>
  );
};

export default TodoPage;
