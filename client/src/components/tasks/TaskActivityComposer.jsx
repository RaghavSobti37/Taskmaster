import React, { useState } from 'react';
import { Send } from 'lucide-react';
import MentionTextarea from '../mentions/MentionTextarea';
import { Button, Spinner } from '../ui';

export default function TaskActivityComposer({
  taskId,
  disabled = false,
  onSend,
  isSending = false,
}) {
  const [body, setBody] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || disabled || isSending) return;
    onSend(trimmed, {
      onSuccess: () => setBody(''),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border-t border-[var(--color-bg-border)] pt-3 mt-3">
      <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
        Message
      </label>
      <MentionTextarea
        value={body}
        onChange={setBody}
        disabled={disabled || isSending}
        rows={3}
        placeholder="Reply in this task… Use @name to mention someone."
        editSessionKey={taskId ? `task-activity-${taskId}` : undefined}
        menuPlacement="above"
      />
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={disabled || isSending || !body.trim()}
        >
          {isSending ? (
            <Spinner size="sm" className="text-white" />
          ) : (
            <>
              <Send size={14} className="mr-1" />
              Send
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
