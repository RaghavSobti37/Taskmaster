import React from 'react';
import MentionTextarea from '../mentions/MentionTextarea';
import TaskStatusButtons from './TaskStatusButtons';
import {
  TaskReviewActionButtons,
  TaskReviewRollbackPanel,
  TaskReviewAdvisory,
} from './TaskReviewActions';

const fieldInputClass =
  'block w-full min-w-0 min-h-[100px] px-3 py-2 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] disabled:opacity-60 text-sm outline-none focus:ring-2 focus:ring-[var(--color-action-primary)]/30 resize-y';

export default function TaskMessageComposeSection({
  message = '',
  onMessageChange,
  disabled = false,
  mentionSessionKey,
  inlineEdit = false,
  status,
  onStatusChange,
  statusDisabled = false,
  reviewActionProps = null,
}) {
  const inputClass = inlineEdit
    ? 'block w-full min-w-0 min-h-[100px] px-3 py-2 rounded-[var(--radius-atomic)] border border-transparent bg-transparent hover:bg-[var(--color-bg-secondary)] focus:bg-[var(--color-bg-surface)] focus:ring-1 focus:ring-[var(--color-bg-border)] disabled:opacity-60 text-sm outline-none resize-y'
    : fieldInputClass;

  const showStatusRow = onStatusChange || reviewActionProps;

  return (
    <section className="w-full min-w-0 space-y-4">
      <div className="w-full min-w-0">
        <MentionTextarea
          value={message}
          onChange={onMessageChange}
          disabled={disabled}
          editSessionKey={mentionSessionKey}
          className={inputClass}
          rows={5}
          placeholder="Write a team update — saved to History when you click Save. @name notifies teammates."
          menuPlacement="below"
        />
        <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
          Updates clear after Save.
        </p>
        {disabled && (
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1 italic">
            Task completed — updates are read-only.
          </p>
        )}
      </div>

      {showStatusRow && (
        <div className="w-full min-w-0 border-t border-[var(--color-bg-border)] pt-3 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 w-full min-w-0">
            {onStatusChange && (
              <TaskStatusButtons
                value={status}
                onChange={onStatusChange}
                disabled={statusDisabled}
                inline
              />
            )}
            {reviewActionProps && (
              <TaskReviewActionButtons {...reviewActionProps} />
            )}
          </div>
          {reviewActionProps && (
            <>
              <TaskReviewRollbackPanel {...reviewActionProps} />
              <TaskReviewAdvisory {...reviewActionProps} />
            </>
          )}
        </div>
      )}
    </section>
  );
}
