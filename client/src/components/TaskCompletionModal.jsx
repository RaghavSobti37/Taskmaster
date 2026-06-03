import React, { useState, useEffect } from 'react';
import { Input, Button, ModalShell, ModalBody, ModalFooter } from './ui';
import MentionTitle from './mentions/MentionTitle';
import {
  hoursMinutesToDecimal,
  isValidCompletionMinutes,
  isValidReviewMinutes,
  REVIEW_TIME_MINUTES,
  MIN_COMPLETION_MINUTES,
} from '../utils/timeSpent';

const TaskCompletionModal = ({
  task,
  isOpen,
  onClose,
  onSubmit,
  submitForReview = false,
  approveReview = false,
}) => {
  const [hoursInput, setHoursInput] = useState('0');
  const [minutesInput, setMinutesInput] = useState(String(MIN_COMPLETION_MINUTES));
  const [timeError, setTimeError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (approveReview) {
        const reviewHours = Math.floor(REVIEW_TIME_MINUTES / 60);
        const reviewMins = REVIEW_TIME_MINUTES % 60;
        setHoursInput(String(reviewHours));
        setMinutesInput(String(reviewMins));
      } else {
        setHoursInput('0');
        setMinutesInput(String(MIN_COMPLETION_MINUTES));
      }
      setTimeError('');
    }
  }, [isOpen, approveReview]);

  if (!task) return null;

  const isValidTime = approveReview
    ? isValidReviewMinutes(hoursInput, minutesInput)
    : isValidCompletionMinutes(hoursInput, minutesInput);

  const handleMarkDone = () => {
    if (!isValidTime) {
      setTimeError(
        approveReview
          ? 'Enter at least 1 minute.'
          : 'Hours and minutes cannot both be zero.'
      );
      return;
    }
    onSubmit(task, hoursMinutesToDecimal(hoursInput, minutesInput));
    onClose();
  };

  const heading = approveReview
    ? 'Approve Task'
    : (submitForReview ? 'Submit for Review' : 'Complete Task');
  const actionLabel = approveReview
    ? 'Approve'
    : (submitForReview ? 'Submit for Review' : 'Mark Done');

  return (
    <ModalShell isOpen={isOpen && !!task} onClose={onClose} size="md" zIndex={9999}>
      <div className="flex flex-col h-full">
        <ModalBody className="flex-1 overflow-y-auto">
          <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] mb-1">{heading}</h2>
          <div className="text-sm text-[var(--color-text-secondary)] mb-6 line-clamp-2">
            <MentionTitle text={task.title} />
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-action-primary)]/20">
            <label className="block text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">
              {approveReview ? 'Review Time' : 'Time Invested'}
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={hoursInput}
                  onChange={(e) => { setHoursInput(e.target.value); setTimeError(''); }}
                  className="w-full text-lg font-bold text-[var(--color-action-primary)] text-center"
                  autoFocus
                  aria-label="Hours"
                />
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] text-center mt-1.5">
                  Hours
                </p>
              </div>
              <span className="text-xl font-bold text-[var(--color-text-muted)] pb-5">:</span>
              <div className="flex-1">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  inputMode="numeric"
                  value={minutesInput}
                  onChange={(e) => { setMinutesInput(e.target.value); setTimeError(''); }}
                  className="w-full text-lg font-bold text-[var(--color-action-primary)] text-center"
                  aria-label="Minutes"
                />
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] text-center mt-1.5">
                  Minutes
                </p>
              </div>
            </div>
            {timeError && <p className="text-xs text-rose-500 mt-2">{timeError}</p>}
            <p className="text-xs text-[var(--color-text-muted)] mt-3">
              {approveReview
                ? 'Logged as [review] in your daily logs only — not the assignee\'s work hours.'
                : (submitForReview
                  ? 'Your work time goes to your daily logs. Your reviewer logs [review] when they approve.'
                  : 'This time will be logged to your daily logs.')}
            </p>
          </div>
        </ModalBody>
        <ModalFooter className="flex-shrink-0 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleMarkDone} className="flex-1">
            {actionLabel}
          </Button>
        </ModalFooter>
      </div>
    </ModalShell>
  );
};

export default TaskCompletionModal;
