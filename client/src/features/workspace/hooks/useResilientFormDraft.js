import { useCallback, useEffect, useRef } from 'react';
import { saveFormDraft, recoverFormDraft, clearFormDraft } from '../api/formDrafts';

/** Autosave form state to local SQLite — enterprise draft recovery. */
export function useResilientFormDraft(formId, values, { enabled = true, debounceMs = 800 } = {}) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled || !formId) return undefined;
    timerRef.current = window.setTimeout(() => {
      saveFormDraft(formId, values).catch(() => {});
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [formId, values, enabled, debounceMs]);

  const recover = useCallback(async () => recoverFormDraft(formId), [formId]);
  const clear = useCallback(async () => clearFormDraft(formId), [formId]);

  return { recover, clear };
}
