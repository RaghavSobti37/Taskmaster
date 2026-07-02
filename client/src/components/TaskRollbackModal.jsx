import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from './ui';
import { ModalShell, ModalBody, ModalFooter } from './ui/modals';
import MentionTitle from './mentions/MentionTitle';

const TaskRollbackModal = ({
  task,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError('');
    }
  }, [isOpen, task]);

  if (!task) return null;

  const handleSubmit = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Please provide a reason for rollback.');
      return;
    }
    onSubmit(task, trimmed);
  };

  return (
    <ModalShell isOpen={isOpen && !!task} onClose={onClose} size="md" zIndex={9999}>
      <div className="flex flex-col h-full">
        <ModalBody className="flex-1 overflow-y-auto">
          <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] mb-1">
            Rollback Task
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)] mb-4 line-clamp-2">
            <MentionTitle text={task.title} />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Task returns to in progress. Assignee sees your reason.
          </p>
          <label className="block text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider mb-2">
            Reason for rollback
          </label>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
            placeholder="What needs to change before this can be approved?"
            rows={4}
            disabled={isSubmitting}
            className="w-full px-3 py-2 text-sm border border-[var(--color-bg-border)] rounded-lg bg-[var(--color-bg-workspace)] text-[var(--color-text-primary)] resize-none focus:outline-none focus:border-[var(--color-action-primary)]/50 disabled:opacity-60"
          />
          {error && (
            <p className="mt-2 text-xs text-red-500" role="alert">
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isSubmitting || !reason.trim()}
            onClick={handleSubmit}
          >
            <RotateCcw size={14} className="mr-1" />
            {isSubmitting ? 'Rolling back…' : 'Confirm rollback'}
          </Button>
        </ModalFooter>
      </div>
    </ModalShell>
  );
};

export default TaskRollbackModal;
