import React from 'react';
import MentionTextarea from '../mentions/MentionTextarea';
import TaskStatusButtons from './TaskStatusButtons';

const fieldLabelClass = 'block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2';
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
}) {
  const inputClass = inlineEdit
    ? 'block w-full min-w-0 min-h-[100px] px-3 py-2 rounded-[var(--radius-atomic)] border border-transparent bg-transparent hover:bg-[var(--color-bg-secondary)] focus:bg-[var(--color-bg-surface)] focus:ring-1 focus:ring-[var(--color-bg-border)] disabled:opacity-60 text-sm outline-none resize-y'
    : fieldInputClass;

  return (
    <section className="w-full min-w-0 space-y-4">
      <div className="w-full min-w-0">
        <label className={fieldLabelClass}>Message</label>
        <MentionTextarea
          value={message}
          onChange={onMessageChange}
          disabled={disabled}
          editSessionKey={mentionSessionKey}
          className={inputClass}
          rows={5}
          placeholder="Type an update, then Save — it posts to History and clears here. @name notifies teammates."
          menuPlacement="below"
        />
        {disabled && (
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1 italic">
            Task completed — message is read-only.
          </p>
        )}
      </div>

      {onStatusChange && (
        <TaskStatusButtons
          value={status}
          onChange={onStatusChange}
          disabled={statusDisabled}
        />
      )}
    </section>
  );
}
