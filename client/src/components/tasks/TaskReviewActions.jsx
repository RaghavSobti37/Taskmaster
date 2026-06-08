import React from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from '../ui';

/**
 * In-review approve / rollback controls (extracted from TaskDetailModal).
 */
export default function TaskReviewActions({
  isInReview,
  isDone = false,
  canReview,
  canRollback,
  canApproveReview,
  assignerName,
  isSaving,
  showRollbackForm,
  rollbackReason,
  onRollbackReasonChange,
  onShowRollbackForm,
  onHideRollbackForm,
  onApprove,
  onConfirmRollback,
}) {
  if (isDone) {
    if (!canRollback) {
      return (
        <p className="text-xs text-[var(--color-text-muted)] py-3 border-t border-[var(--color-bg-border)]">
          This task is completed.
        </p>
      );
    }

    return (
      <div className="space-y-3 py-3 border-t border-[var(--color-bg-border)]">
        <p className="text-xs text-[var(--color-text-muted)]">
          Reopen this task if more work is needed.
        </p>
        <div className="flex flex-wrap gap-3">
          {canRollback && !showRollbackForm && (
            <Button type="button" variant="secondary" size="sm" disabled={isSaving} onClick={onShowRollbackForm}>
              <RotateCcw size={14} className="mr-1" /> Rollback Task
            </Button>
          )}
        </div>
        {canRollback && showRollbackForm && (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={rollbackReason}
              onChange={(e) => onRollbackReasonChange(e.target.value)}
              placeholder="Reason for rollback (required)…"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-[var(--color-bg-border)] rounded-lg bg-[var(--color-bg-workspace)] text-[var(--color-text-primary)] resize-none focus:outline-none focus:border-[var(--color-action-primary)]/50"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isSaving || !rollbackReason.trim()}
                onClick={onConfirmRollback}
              >
                Confirm rollback
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onHideRollbackForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!isInReview) return null;

  if (!canApproveReview && !canReview) {
    return (
      <p className="text-xs text-[var(--color-text-muted)] py-3 border-t border-[var(--color-bg-border)]">
        Awaiting review by {assignerName}
      </p>
    );
  }

  if (!canReview && !canRollback) return null;

  return (
    <div className="space-y-3 py-3 border-t border-amber-500/30">
      <div className="flex flex-wrap gap-3">
        {canReview && (
          <Button type="button" variant="primary" size="sm" disabled={isSaving} onClick={onApprove}>
            <Check size={14} className="mr-1" />
            {isSaving ? 'Saving...' : 'Review & Approve'}
          </Button>
        )}
        {canRollback && !showRollbackForm && (
          <Button type="button" variant="secondary" size="sm" disabled={isSaving} onClick={onShowRollbackForm}>
            <RotateCcw size={14} className="mr-1" /> Rollback
          </Button>
        )}
      </div>
      {canRollback && showRollbackForm && (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={rollbackReason}
            onChange={(e) => onRollbackReasonChange(e.target.value)}
            placeholder="Reason for rollback (required)…"
            rows={3}
            className="w-full px-3 py-2 text-sm border border-[var(--color-bg-border)] rounded-lg bg-[var(--color-bg-workspace)] text-[var(--color-text-primary)] resize-none focus:outline-none focus:border-[var(--color-action-primary)]/50"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isSaving || !rollbackReason.trim()}
              onClick={onConfirmRollback}
            >
              Confirm rollback
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onHideRollbackForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
