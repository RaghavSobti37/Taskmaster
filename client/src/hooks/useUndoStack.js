import { useCallback, useRef } from 'react';
import { pushCustomToast } from '../lib/notifications';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Undo stack with toast action — Cmd/Ctrl+Z when stack non-empty.
 */
export function useUndoStack({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const stackRef = useRef([]);

  const pushUndo = useCallback(
    ({ label, undo, toastId }) => {
      const entry = { label, undo, at: Date.now() };
      stackRef.current = [entry, ...stackRef.current].slice(0, 20);

      pushCustomToast(
        (t) => (
          <div className="flex items-center gap-3 text-xs font-semibold text-[var(--color-text-primary)]">
            <span className="truncate">{label}</span>
            <button
              type="button"
              className="shrink-0 rounded-md border border-[var(--color-bg-border)] px-2 py-1 text-[10px] font-black uppercase tracking-wide"
              onClick={() => {
                undo?.();
                stackRef.current = stackRef.current.filter((e) => e !== entry);
                t.dismiss?.();
              }}
            >
              Undo
            </button>
          </div>
        ),
        { id: toastId || `undo-${Date.now()}`, duration: timeoutMs },
      );
    },
    [timeoutMs],
  );

  const popUndo = useCallback(() => {
    const [entry] = stackRef.current;
    if (!entry) return false;
    entry.undo?.();
    stackRef.current = stackRef.current.slice(1);
    return true;
  }, []);

  return { pushUndo, popUndo };
}
