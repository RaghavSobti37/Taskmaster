import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui/primitives';

const MAX_VISIBLE_CHANGES = 4;

export default function UnsavedChangesBar({
  hasChanges,
  onCancel,
  onSave,
  isSaving,
  elevated = false,
  changes = [],
}) {
  const visibleChanges = changes.slice(0, MAX_VISIBLE_CHANGES);
  const hiddenCount = Math.max(0, changes.length - MAX_VISIBLE_CHANGES);

  if (!hasChanges) return null;

  const bar = (
        <div
          className={`tm-unsaved-bar-enter fixed left-1/2 -translate-x-1/2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] shadow-2xl rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 min-w-[min(420px,calc(100vw-2rem))] max-w-[min(720px,calc(100vw-2rem))] sm:justify-between bottom-[calc(5.25rem+env(safe-area-inset-bottom))] lg:bottom-6 ${
            elevated ? 'z-[1200]' : 'z-50'
          }`}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="text-sm font-bold text-[var(--color-text-primary)]">
              Careful — you have unsaved changes!
            </div>
            {visibleChanges.length > 0 && (
              <ul className="space-y-1 text-[11px] text-[var(--color-text-secondary)]">
                {visibleChanges.map((change) => (
                  <li key={change.field} className="truncate">
                    <span className="font-bold text-blue-400">{change.label}</span>
                    {' '}
                    <span className="line-through text-[var(--color-text-muted)]">{change.oldValue}</span>
                    {' → '}
                    <span className="font-bold text-emerald-400">{change.newValue}</span>
                  </li>
                ))}
                {hiddenCount > 0 && (
                  <li className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    +{hiddenCount} more
                  </li>
                )}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSaving}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] min-h-11 touch-manipulation"
            >
              {elevated ? 'Discard' : 'Cancel'}
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white min-h-11 touch-manipulation"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
  );

  if (elevated && typeof document !== 'undefined') {
    return createPortal(bar, document.body);
  }

  return bar;
}
