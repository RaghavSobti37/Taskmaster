import React from 'react';
import { useTaskActivity, usePostTaskMessage } from '../../hooks/queries/tasks';
import { resolveTaskId } from '../../utils/taskCompletion';
import TaskActivityTimeline from './TaskActivityTimeline';
import TaskActivityComposer from './TaskActivityComposer';

export default function TaskActivityPanel({ task, enabled = true }) {
  const taskId = resolveTaskId(task);
  const isDone = task?.status === 'done';

  const { data: items = [], isLoading } = useTaskActivity(taskId, {
    enabled: enabled && !!taskId,
    markRead: true,
  });

  const postMutation = usePostTaskMessage(taskId);

  const handleSend = (body, { onSuccess } = {}) => {
    postMutation.mutate(body, { onSuccess });
  };

  return (
    <section className="border-t border-[var(--color-bg-border)] pt-4 mt-4">
      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
        History & conversation
      </h4>
      <div className="max-h-[min(280px,40vh)] overflow-y-auto tm-modal-scroll pr-1">
        <TaskActivityTimeline items={items} isLoading={isLoading} />
      </div>
      <TaskActivityComposer
        taskId={taskId}
        disabled={isDone}
        onSend={handleSend}
        isSending={postMutation.isPending}
      />
      {isDone && (
        <p className="text-[10px] text-[var(--color-text-muted)] mt-2 italic">
          Task completed — conversation is read-only.
        </p>
      )}
    </section>
  );
}
