import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useUnsavedChangesContext } from '../contexts/UnsavedChangesContext';

export function stableJsonEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}

export function cloneSnapshot(value) {
  if (value === undefined || value === null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

/**
 * Publish dirty state to the global save/cancel bar.
 * Use on settings pages, modals, and FullScreenWorkspace editors.
 */
export function useUnsavedChanges({
  baseline,
  draft,
  setDraft,
  hasChanges: hasChangesProp,
  onSave,
  onCancel,
  isSaving = false,
  enabled = true,
  elevated = false,
}) {
  const ctx = useUnsavedChangesContext();
  const registrationId = useId();
  const onSaveRef = useRef(onSave);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onSaveRef.current = onSave;
    onCancelRef.current = onCancel;
  }, [onSave, onCancel]);

  const hasChanges =
    hasChangesProp !== undefined
      ? hasChangesProp
      : !stableJsonEqual(draft, baseline);

  const revert = useCallback(() => {
    if (setDraft) setDraft(cloneSnapshot(baseline));
    onCancelRef.current?.();
  }, [baseline, setDraft]);

  const save = useCallback(async () => {
    if (!onSaveRef.current) return;
    await onSaveRef.current(draft);
  }, [draft]);

  useEffect(() => {
    if (!ctx || !enabled) return undefined;
    if (!hasChanges) {
      ctx.unregister(registrationId);
      return undefined;
    }
    ctx.register(registrationId, {
      hasChanges: true,
      onCancel: revert,
      onSave: save,
      isSaving,
      elevated,
    });
    return () => ctx.unregister(registrationId);
  }, [ctx, enabled, hasChanges, registrationId, revert, save, isSaving, elevated]);

  return { hasChanges, revert, save, isSaving };
}

/**
 * Draft + baseline state with auto dirty detection and bar registration.
 */
export function useUnsavedDraft(initialValue, { onSave, compare, enabled = true, elevated = false } = {}) {
  const [baseline, setBaseline] = useState(() => cloneSnapshot(initialValue));
  const [draft, setDraft] = useState(() => cloneSnapshot(initialValue));
  const [isSaving, setIsSaving] = useState(false);
  const initialRef = useRef(initialValue);

  useEffect(() => {
    if (stableJsonEqual(initialRef.current, initialValue)) return;
    initialRef.current = initialValue;
    const snap = cloneSnapshot(initialValue);
    setBaseline(snap);
    setDraft(snap);
  }, [initialValue]);

  const hasChanges = compare
    ? compare(draft, baseline)
    : !stableJsonEqual(draft, baseline);

  const revert = useCallback(() => setDraft(cloneSnapshot(baseline)), [baseline]);

  const save = useCallback(async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(draft);
      const next = cloneSnapshot(draft);
      setBaseline(next);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, draft]);

  const markClean = useCallback((value) => {
    const snap = cloneSnapshot(value ?? draft);
    setBaseline(snap);
    setDraft(snap);
  }, [draft]);

  useUnsavedChanges({
    baseline,
    draft,
    setDraft,
    hasChanges,
    onSave: save,
    onCancel: revert,
    isSaving,
    enabled,
    elevated,
  });

  return { draft, setDraft, baseline, setBaseline, hasChanges, revert, save, isSaving, markClean };
}
