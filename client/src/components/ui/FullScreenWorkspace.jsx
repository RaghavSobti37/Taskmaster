import React, { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export const FullScreenWorkspace = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  sidebar,
  onSave,
  onCancel,
  hasChanges = false,
  saveDisabled = false,
  isSaving = false,
  extraActions,
  mainClassName = 'max-w-4xl',
  centerMain = true,
}) => {
  const dirty = isOpen && hasChanges && !!onSave;
  const workspaceRef = useRef(null);
  const titleId = React.useId();
  useFocusTrap(isOpen, workspaceRef);

  const discardEdits = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  const handleClose = useCallback(() => {
    if (dirty) {
      discardEdits();
    }
    onClose?.();
  }, [dirty, discardEdits, onClose]);

  useUnsavedChanges({
    hasChanges: dirty && !saveDisabled,
    onSave,
    onCancel: discardEdits,
    isSaving,
    enabled: dirty,
    elevated: true,
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown, true);
    }
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleClose]);

  return (
    <>
      {isOpen && (
        <div
          ref={workspaceRef}
          className="fixed inset-0 z-[500] bg-[var(--color-bg-primary)] flex flex-col animate-in fade-in zoom-in-95 duration-200 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="h-14 min-h-14 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] flex items-center justify-between px-4 sm:px-6 shrink-0">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 pr-2">
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close workspace"
                className="inline-flex items-center justify-center min-h-11 min-w-11 p-2 hover:bg-[var(--color-bg-secondary)] rounded-[var(--radius-atomic)] transition-colors shrink-0 touch-manipulation"
              >
                <X size={20} />
              </button>
              <div className="min-w-0">
                <h2 id={titleId} className="tm-data-primary text-sm font-medium leading-none truncate">{title}</h2>
                {subtitle && <p className="tm-data-meta text-xs mt-1 truncate">{subtitle}</p>}
              </div>
            </div>
            {extraActions ? (
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                {extraActions}
              </div>
            ) : null}
          </div>

          <div className={`flex-1 flex overflow-hidden ${sidebar ? 'flex-col lg:flex-row' : 'flex-col'}`}>
            <div className="flex-1 lg:w-[65%] min-w-0 overflow-y-auto px-4 sm:px-6 py-4 custom-scrollbar bg-[var(--color-bg-surface)]">
              <div className={`${mainClassName} ${centerMain ? 'mx-auto' : 'w-full'} space-y-6`}>
                {children}
              </div>
            </div>

            {sidebar ? (
              <aside className="w-full lg:w-[35%] lg:max-w-[480px] shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] overflow-y-auto px-4 sm:px-6 py-4 custom-scrollbar">
                {sidebar}
              </aside>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
};
