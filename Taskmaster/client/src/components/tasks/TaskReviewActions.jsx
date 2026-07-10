import React from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from '../ui';
import Banner from '../ui/Banner';

const rollbackTextareaClass =
  'w-full min-w-0 px-3 py-2 text-sm border border-[var(--color-bg-border)] rounded-lg bg-[var(--color-bg-workspace)] text-[var(--color-text-primary)] resize-y min-h-[5rem] focus:outline-none focus:border-[var(--color-action-primary)]/50';

export function TaskReviewActionButtons({
  isInReview,
  isDone = false,
  canReview,
  canRollback,
  showRollbackForm,
  isSaving,
  onShowRollbackForm,
  onApprove,
}) {
  if (isDone) return null;
  if (!isInReview) return null;
  if (!canReview && !canRollback) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 min-w-0">
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
  );
}

export function TaskReviewRollbackPanel({
  isInReview,
  isDone = false,
  canRollback,
  showRollbackForm,
  rollbackReason,
  onRollbackReasonChange,
  onHideRollbackForm,
  onConfirmRollback,
  isSaving,
}) {
  const showPanel = showRollbackForm && canRollback && (isInReview || isDone);
  if (!showPanel) return null;

  return (
    <div className="w-full min-w-0 space-y-2">
      <textarea
        autoFocus
        value={rollbackReason}
        onChange={(e) => onRollbackReasonChange(e.target.value)}
        placeholder="Reason for rollback (required)…"
        rows={3}
        className={rollbackTextareaClass}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant={isDone ? 'primary' : 'secondary'}
          size="sm"
          disabled={isSaving || !rollbackReason.trim()}
          onClick={onConfirmRollback}
          className={isDone ? '!bg-amber-500 hover:!bg-amber-400 !text-[var(--color-bg-primary)] border-0' : ''}
        >
          Confirm rollback
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onHideRollbackForm}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function TaskReviewAdvisory({ isInReview, isDone, canApproveReview, canReview, assignerName }) {
  if (isDone || !isInReview) return null;
  if (canApproveReview || canReview) return null;

  return (
    <Banner
      variant="advisory"
      message={`Awaiting review by ${assignerName}`}
    />
  );
}

/**
 * In-review approve / rollback controls (extracted from TaskDetailModal).
 * Prefer TaskMessageComposeSection + split exports for stacked layout.
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
  inline = false,
  stacked = false,
}) {
  const shellClass = inline ? 'space-y-2' : 'space-y-3 py-3 border-t border-amber-500/30';

  if (isDone && !showRollbackForm) return null;

  if (isDone && showRollbackForm && canRollback) {
    return (
      <div className={`${shellClass} ${inline ? '' : 'border-t border-amber-500/30'}`}>
        <p className="text-xs text-[var(--color-text-muted)]">
          Reopen this task if more work is needed.
        </p>
        <TaskReviewRollbackPanel
          isInReview={isInReview}
          isDone={isDone}
          canRollback={canRollback}
          showRollbackForm={showRollbackForm}
          rollbackReason={rollbackReason}
          onRollbackReasonChange={onRollbackReasonChange}
          onHideRollbackForm={onHideRollbackForm}
          onConfirmRollback={onConfirmRollback}
          isSaving={isSaving}
        />
      </div>
    );
  }

  if (!isInReview) return null;

  if (!canApproveReview && !canReview) {
    return (
      <Banner
        variant="advisory"
        message={`Awaiting review by ${assignerName}`}
        className={inline ? '' : 'mt-3'}
      />
    );
  }

  if (!canReview && !canRollback) return null;

  if (stacked) {
    return (
      <>
        <TaskReviewActionButtons
          isInReview={isInReview}
          isDone={isDone}
          canReview={canReview}
          canRollback={canRollback}
          showRollbackForm={showRollbackForm}
          isSaving={isSaving}
          onShowRollbackForm={onShowRollbackForm}
          onApprove={onApprove}
        />
        <TaskReviewRollbackPanel
          isInReview={isInReview}
          isDone={isDone}
          canRollback={canRollback}
          showRollbackForm={showRollbackForm}
          rollbackReason={rollbackReason}
          onRollbackReasonChange={onRollbackReasonChange}
          onHideRollbackForm={onHideRollbackForm}
          onConfirmRollback={onConfirmRollback}
          isSaving={isSaving}
        />
        <TaskReviewAdvisory
          isInReview={isInReview}
          isDone={isDone}
          canApproveReview={canApproveReview}
          canReview={canReview}
          assignerName={assignerName}
        />
      </>
    );
  }

  return (
    <div className={shellClass}>
      <TaskReviewActionButtons
        isInReview={isInReview}
        isDone={isDone}
        canReview={canReview}
        canRollback={canRollback}
        showRollbackForm={showRollbackForm}
        isSaving={isSaving}
        onShowRollbackForm={onShowRollbackForm}
        onApprove={onApprove}
      />
      <TaskReviewRollbackPanel
        isInReview={isInReview}
        isDone={isDone}
        canRollback={canRollback}
        showRollbackForm={showRollbackForm}
        rollbackReason={rollbackReason}
        onRollbackReasonChange={onRollbackReasonChange}
        onHideRollbackForm={onHideRollbackForm}
        onConfirmRollback={onConfirmRollback}
        isSaving={isSaving}
      />
    </div>
  );
}
