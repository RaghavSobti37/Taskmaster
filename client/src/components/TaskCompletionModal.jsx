import React, { useState, useEffect } from 'react';
import { Input, Button, ModalShell, ModalBody, ModalFooter } from './ui';

const TaskCompletionModal = ({ task, isOpen, onClose, onSubmit }) => {
  const [hours, setHours] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) setHours(1);
  }, [isOpen]);

  if (!task) return null;

  return (
    <ModalShell isOpen={isOpen && !!task} onClose={onClose} size="md" zIndex={9999}>
      <div className="flex flex-col h-full">
        <ModalBody className="flex-1 overflow-y-auto">
          <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] mb-1">Complete Task</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6 line-clamp-2">{task.title}</p>

          <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-action-primary)]/20">
            <label className="block text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">Time Invested (Hours)</label>
            <Input
              type="number"
              min="0.5"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full text-lg font-bold text-[var(--color-action-primary)]"
              autoFocus
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-2">This time will be logged to your daily logs.</p>
          </div>
        </ModalBody>
        <ModalFooter className="flex-shrink-0 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={async () => {
              setIsSubmitting(true);
              await onSubmit(task, Number(hours));
              setIsSubmitting(false);
            }}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Saving...' : 'Mark Done'}
          </Button>
        </ModalFooter>
      </div>
    </ModalShell>
  );
};

export default TaskCompletionModal;
