/** Status button styles — shared with project task list (ProjectList). */

export const TASK_STATUS_BUTTON_OPTIONS = [
  { value: 'todo', label: 'To Do', letter: 'T' },
  { value: 'in-progress', label: 'In Progress', letter: 'P' },
  { value: 'in-review', label: 'In Review', letter: 'R' },
  { value: 'done', label: 'Done', letter: 'D' },
];

const STATUS_ACTIVE_CLASS = {
  todo: 'bg-slate-500 border-slate-500 text-white',
  'in-progress': 'bg-blue-500 border-blue-500 text-white',
  'in-review': 'bg-purple-500 border-purple-500 text-white',
  done: 'bg-[var(--color-pastel-slate-text)] border-[var(--color-pastel-slate-text)] text-white',
};

const STATUS_INACTIVE_CLASS = {
  todo: 'bg-slate-500/10 border-slate-400/60 text-slate-600 dark:text-slate-300 hover:bg-slate-500/20 hover:border-slate-400',
  'in-progress': 'bg-blue-500/10 border-blue-400/60 text-blue-600 dark:text-blue-300 hover:bg-blue-500/20 hover:border-blue-400',
  'in-review': 'bg-purple-500/10 border-purple-400/60 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20 hover:border-purple-400',
  done: 'bg-[var(--color-pastel-slate-text)]/10 border-[var(--color-pastel-slate-text)]/50 text-[var(--color-pastel-slate-text)] hover:bg-[var(--color-pastel-slate-text)]/20',
};

export const taskStatusButtonClass = (status, active) => {
  const key = String(status || 'todo').toLowerCase();
  if (active) {
    return STATUS_ACTIVE_CLASS[key] || STATUS_ACTIVE_CLASS.todo;
  }
  return STATUS_INACTIVE_CLASS[key] || STATUS_INACTIVE_CLASS.todo;
};

export const progressForTaskStatus = (status) => {
  if (status === 'done') return 100;
  if (status === 'todo') return 0;
  return 50;
};
