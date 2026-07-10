import React from 'react';
import { RotateCcw } from 'lucide-react';
import { canRollbackTask } from '../../utils/taskReview';

export default function CompletedTaskRollbackButton({ task, user, onClick, size = 16 }) {
  if (!task || !canRollbackTask(task, user)) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(task);
      }}
      className="shrink-0 p-1 rounded-md text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 transition-colors"
      aria-label={`Rollback task: ${task.title || 'task'}`}
      title="Rollback task"
    >
      <RotateCcw size={size} />
    </button>
  );
}
