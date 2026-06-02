import React, { useState, useEffect } from 'react';
import { Input, Button, ModalShell, ModalBody, ModalFooter } from './ui';
import MentionTitle from './mentions/MentionTitle';

const TaskCompletionModal = ({ task, isOpen, onClose, onSubmit, submitForReview = false }) => {
  const [hours, setHours] = useState(1);
  const [hoursError, setHoursError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setHours(1);
      setHoursError('');
    }
  }, [isOpen]);

  if (!task) return null;

  const parsedHours = Number(hours);
  const isValidHours = Number.isFinite(parsedHours) && parsedHours >= 0.5;

  const handleMarkDone = () => {
    if (!isValidHours) {
      setHoursError('Enter at least 0.5 hours.');
      return;
    }
    onSubmit(task, parsedHours);
    onClose();
  };

  const heading = submitForReview ? 'Submit for Review' : 'Complete Task';
  const actionLabel = submitForReview ? 'Submit for Review' : 'Mark Done';

  return (
    <ModalShell isOpen={isOpen && !!task} onClose={onClose} size="md" zIndex={9999}>
      <div className="flex flex-col h-full">
        <ModalBody className="flex-1 overflow-y-auto">
          <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] mb-1">{heading}</h2>
          <div className="text-sm text-[var(--color-text-secondary)] mb-6 line-clamp-2">
            <MentionTitle text={task.title} />
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-action-primary)]/20">
            <label className="block text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">Time Invested (Hours)</label>
            <Input
              type="number"
              min="0.5"
              step="0.5"
              value={hours}
              onChange={(e) => { setHours(e.target.value); setHoursError(''); }}
              className="w-full text-lg font-bold text-[var(--color-action-primary)]"
              autoFocus
            />
            {hoursError && <p className="text-xs text-rose-500 mt-1">{hoursError}</p>}
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              {submitForReview
                ? 'This sends the task for approval. Time is logged to your daily logs.'
                : 'This time will be logged to your daily logs.'}
            </p>
          </div>
        </ModalBody>
        <ModalFooter className="flex-shrink-0 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleMarkDone} className="flex-1" disabled={!isValidHours}>
            {actionLabel}
          </Button>
        </ModalFooter>
      </div>
    </ModalShell>
  );
};

export default TaskCompletionModal;
