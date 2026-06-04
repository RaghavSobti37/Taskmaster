/** Status button styles — shared with project task list (ProjectList). */

export const TASK_STATUS_BUTTON_OPTIONS = [
  { value: 'todo', label: 'To Do', letter: 'T' },
  { value: 'in-progress', label: 'In Progress', letter: 'P' },
  { value: 'in-review', label: 'In Review', letter: 'R' },
  { value: 'done', label: 'Done', letter: 'D' },
];

export const taskStatusButtonClass = (status, active) => {
  if (!active) {
    return 'bg-transparent border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]';
  }
  switch (status) {
    case 'done':
      return 'bg-[var(--color-pastel-slate-text)] border-[var(--color-pastel-slate-text)] text-white';
    case 'in-review':
      return 'bg-purple-500 border-purple-500 text-white';
    case 'in-progress':
      return 'bg-blue-500 border-blue-500 text-white';
    default:
      return 'bg-slate-500 border-slate-500 text-white';
  }
};

export const progressForTaskStatus = (status) => {
  if (status === 'done') return 100;
  if (status === 'todo') return 0;
  return 50;
};
