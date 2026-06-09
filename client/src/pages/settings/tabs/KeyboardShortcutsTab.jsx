import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Keyboard, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui';
import {
  SHORTCUT_ACTIONS,
  SHORTCUT_CATEGORY_LABELS,
  mergeShortcutBindings,
  filterActionsForUser,
} from '../../../lib/shortcutDefaultsShared';
import {
  buildBindingFromModsAndMain,
  formatKeysForDisplay,
  formatConflictLabel,
  getBindingConflicts,
  getPlatformTag,
  isMacPlatform,
  isModifierOnlyKeyEvent,
  mainKeyFromEvent,
  modsFromEvent,
  G_CHORD_TIMEOUT_MS,
} from '../../../lib/shortcutBindingUtils';
import { setShortcutRecordingActive } from '../../../lib/shortcutRecordingBridge';
import { useAuth } from '../../../contexts/AuthContext';
import { isAdminUser } from '../../../utils/departmentPermissions';
import { useShortcutPreferences, SHORTCUT_PREFERENCES_QUERY_KEY } from '../../../hooks/useShortcutPreferences';
import { stableJsonEqual } from '../../../hooks/useUnsavedChanges';

function KbdChip({ children }) {
  return (
    <kbd className="inline-flex min-w-[1.25rem] items-center justify-center rounded border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] px-1 py-0.5 font-mono text-[9px] font-bold text-[var(--color-text-primary)]">
      {children}
    </kbd>
  );
}

function BindingDisplay({ binding }) {
  if (!binding?.keys?.length) {
    return <span className="text-[10px] text-[var(--color-text-muted)]">Off</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-0.5">
      {formatKeysForDisplay(binding.keys).split(' ').map((part, i) => (
        <KbdChip key={i}>{part}</KbdChip>
      ))}
    </span>
  );
}

const KeyboardShortcutsTab = () => {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useShortcutPreferences();
  const [bindings, setBindings] = useState({});
  const [recording, setRecording] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const captureRef = useRef(null);
  const recordingRef = useRef(null);
  const sequenceTimerRef = useRef(null);

  const actions = useMemo(
    () => filterActionsForUser(SHORTCUT_ACTIONS, { isAdmin }),
    [isAdmin]
  );

  const baseline = useMemo(
    () => mergeShortcutBindings(data?.bindings || {}),
    [data?.bindings]
  );

  useEffect(() => {
    if (data?.bindings) {
      setBindings(mergeShortcutBindings(data.bindings));
    }
  }, [data?.bindings]);

  const isDirty = !stableJsonEqual(bindings, baseline);
  const platform = getPlatformTag();
  const modHint = isMacPlatform() ? '⌘' : 'Ctrl';

  const grouped = useMemo(() => {
    const map = {};
    for (const action of actions) {
      if (!map[action.category]) map[action.category] = [];
      map[action.category].push(action);
    }
    return map;
  }, [actions]);

  const clearSequenceTimer = useCallback(() => {
    if (sequenceTimerRef.current) {
      clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearSequenceTimer();
    recordingRef.current = null;
    setRecording(null);
    setShortcutRecordingActive(false);
  }, [clearSequenceTimer]);

  const startRecording = useCallback((actionId, mode) => {
    clearSequenceTimer();
    const next = {
      id: actionId,
      mode,
      sequence: [],
      mods: { mod: false, shift: false, alt: false },
    };
    recordingRef.current = next;
    setRecording(next);
    setShortcutRecordingActive(true);
    requestAnimationFrame(() => captureRef.current?.focus());
  }, [clearSequenceTimer]);

  const onRecordKey = useCallback((e) => {
    const rec = recordingRef.current;
    if (!rec) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      stopRecording();
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      setBindings((prev) => ({ ...prev, [rec.id]: null }));
      stopRecording();
      return;
    }

    if (rec.mode === 'sequence') {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const token = e.key.length === 1 ? e.key.toLowerCase() : null;
      if (!token) return;

      const seq = [...rec.sequence, token];
      if (seq.length >= 2) {
        setBindings((prev) => ({ ...prev, [rec.id]: { keys: seq } }));
        stopRecording();
      } else {
        const waiting = { ...rec, sequence: seq };
        recordingRef.current = waiting;
        setRecording(waiting);
        clearSequenceTimer();
        sequenceTimerRef.current = setTimeout(() => {
          if (recordingRef.current?.sequence?.length === 1) {
            recordingRef.current = null;
            setRecording(null);
            setShortcutRecordingActive(false);
          }
        }, G_CHORD_TIMEOUT_MS);
      }
      return;
    }

    const mods = modsFromEvent(e);
    const waiting = { ...rec, mods };
    recordingRef.current = waiting;
    setRecording(waiting);

    if (isModifierOnlyKeyEvent(e)) return;

    const main = mainKeyFromEvent(e);
    if (!main || ['control', 'meta', 'alt', 'shift'].includes(main)) return;

    const captured = buildBindingFromModsAndMain(mods, main);
    setBindings((prev) => ({ ...prev, [rec.id]: captured }));
    stopRecording();
  }, [stopRecording, clearSequenceTimer]);

  useEffect(() => {
    window.addEventListener('keydown', onRecordKey, true);
    return () => window.removeEventListener('keydown', onRecordKey, true);
  }, [onRecordKey]);

  useEffect(() => () => {
    clearSequenceTimer();
    setShortcutRecordingActive(false);
  }, [clearSequenceTimer]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const overrides = {};
      const defaults = mergeShortcutBindings({});
      for (const action of actions) {
        const current = bindings[action.id];
        const defaultBinding = defaults[action.id];
        if (current === null && defaultBinding) {
          overrides[action.id] = null;
        } else if (current?.keys && JSON.stringify(current.keys) !== JSON.stringify(defaultBinding?.keys)) {
          overrides[action.id] = current;
        }
      }

      const { data: saved } = await axios.post('/api/customization/shortcuts', { bindings: overrides });
      queryClient.setQueryData(SHORTCUT_PREFERENCES_QUERY_KEY, saved);
      setBindings(saved.effectiveBindings || mergeShortcutBindings(saved.bindings));
    } catch (err) {
      console.error('Failed to save shortcuts', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const { data: saved } = await axios.post('/api/customization/shortcuts/reset');
      queryClient.setQueryData(SHORTCUT_PREFERENCES_QUERY_KEY, saved);
      setBindings(saved.effectiveBindings || mergeShortcutBindings({}));
    } catch (err) {
      console.error('Failed to reset shortcuts', err);
    } finally {
      setResetting(false);
    }
  };

  if (isLoading) {
    return <p className="text-xs text-[var(--color-text-muted)] px-4 py-3">Loading shortcuts…</p>;
  }

  if (isError) {
    return (
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs text-rose-500">Could not load shortcut preferences.</p>
        <Button size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const recordingLabel = recording
    ? recording.mode === 'sequence'
      ? recording.sequence.length
        ? `Press next key… (${recording.sequence.map((k) => k.toUpperCase()).join(' → ')} → ?)`
        : 'Press keys in order (e.g. G, then T)'
      : (() => {
          const partial = buildBindingFromModsAndMain(recording.mods || {}, null);
          const modPart = partial.keys.length
            ? `${formatKeysForDisplay(partial.keys)} + …`
            : 'Hold modifiers, then press final key';
          return `${modPart} (e.g. Ctrl+Shift+K)`;
        })()
    : null;

  return (
    <div className="flex flex-col min-h-0" data-shortcuts-ignore>
      <div
        ref={captureRef}
        tabIndex={-1}
        aria-hidden="true"
        className="fixed opacity-0 pointer-events-none w-0 h-0"
        data-shortcuts-ignore
      />

      <div className="shrink-0 border-b border-[var(--color-bg-border)] px-4 py-2.5 bg-[var(--color-bg-primary)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Keyboard size={16} className="text-[var(--color-action-primary)] shrink-0" />
          <div className="min-w-0">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">Shortcuts</h3>
            <p className="text-[10px] text-[var(--color-text-muted)] leading-snug">
              {modHint}+K palette · / search · G+letter go-to · T/D/N/E/A/P quick actions · {platform === 'mac' ? 'macOS' : platform === 'win' ? 'Windows' : 'Linux'} conflict hints
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={resetting || saving}>
            <RotateCcw size={12} />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!isDirty || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {recordingLabel && (
        <div className="shrink-0 px-4 py-1.5 bg-[var(--color-action-primary)]/10 border-b border-[var(--color-action-primary)]/20 text-[10px] font-bold text-[var(--color-action-primary)] animate-pulse">
          {recordingLabel} — Esc cancel · Backspace disable
        </div>
      )}

      <div className="overflow-y-auto custom-scrollbar px-4 py-2 space-y-3">
        {Object.entries(grouped).map(([category, categoryActions]) => (
          <section key={category}>
            <h4 className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1 px-1">
              {SHORTCUT_CATEGORY_LABELS[category] || category}
              {category === 'nav' && <span className="font-normal normal-case tracking-normal"> · two keys in order</span>}
            </h4>
            <div className="rounded-lg border border-[var(--color-bg-border)] overflow-hidden bg-[var(--color-bg-primary)]">
              <table className="w-full text-left">
                <tbody>
                  {categoryActions.map((action) => {
                    const binding = bindings[action.id];
                    const conflicts = binding?.keys
                      ? getBindingConflicts(binding.keys, { bindingsMap: bindings, excludeActionId: action.id, actions })
                      : [];
                    const isRecording = recording?.id === action.id;
                    const mode = action.category === 'nav' ? 'sequence' : 'combo';

                    return (
                      <tr
                        key={action.id}
                        className={`border-t border-[var(--color-bg-border)] first:border-t-0 ${isRecording ? 'bg-[var(--color-action-primary)]/5' : ''}`}
                      >
                        <td className="py-1.5 pl-3 pr-2 text-xs font-medium text-[var(--color-text-primary)] w-[45%]">
                          {action.label}
                        </td>
                        <td className="py-1.5 px-2">
                          <button
                            type="button"
                            onClick={() => startRecording(action.id, mode)}
                            className={`inline-flex items-center min-h-[28px] rounded-md border px-2 py-0.5 transition-colors ${
                              isRecording
                                ? 'border-[var(--color-action-primary)] ring-1 ring-[var(--color-action-primary)]/30'
                                : 'border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)]/40'
                            }`}
                          >
                            {isRecording ? (
                              recording.mode === 'sequence' && recording.sequence.length > 0 ? (
                                <span className="inline-flex flex-wrap items-center gap-0.5">
                                  {recording.sequence.map((k, i) => (
                                    <KbdChip key={i}>{k.toUpperCase()}</KbdChip>
                                  ))}
                                  <span className="text-[10px] text-[var(--color-action-primary)]">…</span>
                                </span>
                              ) : recording.mode === 'combo' && (recording.mods?.mod || recording.mods?.shift || recording.mods?.alt) ? (
                                <span className="inline-flex flex-wrap items-center gap-0.5">
                                  {formatKeysForDisplay(
                                    buildBindingFromModsAndMain(recording.mods, null).keys
                                  ).split(' ').map((part, i) => (
                                    <KbdChip key={i}>{part}</KbdChip>
                                  ))}
                                  <span className="text-[10px] text-[var(--color-action-primary)]">+ …</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-[var(--color-action-primary)]">Listening…</span>
                              )
                            ) : (
                              <BindingDisplay binding={binding} />
                            )}
                          </button>
                        </td>
                        <td className="py-1.5 pr-3 text-right w-[28%]">
                          {conflicts.length > 0 && (
                            <span className="inline-flex items-start gap-1 text-[9px] text-amber-600 dark:text-amber-400 max-w-[11rem] ml-auto">
                              <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                              <span className="leading-tight">{conflicts.map(formatConflictLabel).join(' · ')}</span>
                            </span>
                          )}
                          {binding && !isRecording && (
                            <button
                              type="button"
                              onClick={() => setBindings((prev) => ({ ...prev, [action.id]: null }))}
                              className="text-[9px] font-bold text-[var(--color-text-muted)] hover:text-rose-500 ml-2"
                            >
                              Off
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default KeyboardShortcutsTab;
