import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { KeyboardShortcutsContext } from './keyboardShortcutsContext.shared';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isAdminUser } from '../utils/departmentPermissions';
import { useShortcutPreferences } from '../hooks/useShortcutPreferences';
import { mergeShortcutBindings, filterActionsForUser, SHORTCUT_ACTIONS } from '../lib/shortcutDefaultsShared';
import {
  eventMatchesCombo,
  isSequenceBinding,
  G_CHORD_TIMEOUT_MS,
} from '../lib/shortcutBindingUtils';
import { invokeShortcutQuickAction } from '../lib/shortcutActionBridge';
import { isShortcutRecordingActive } from '../lib/shortcutRecordingBridge';
import {
  isTypingTarget,
  bindingMatchesSequenceComplete,
} from '../lib/keyboardShortcuts';
import { filterActionsByPageAccess } from '../utils/navPageAccess';

export function KeyboardShortcutsProvider({ children }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const { data: shortcutPrefs } = useShortcutPreferences(!!user);

  const bindingsMap = useMemo(
    () => shortcutPrefs?.effectiveBindings || mergeShortcutBindings(shortcutPrefs?.bindings),
    [shortcutPrefs]
  );

  const allowedShortcutActions = useMemo(
    () => filterActionsByPageAccess(filterActionsForUser(SHORTCUT_ACTIONS, { isAdmin }), user),
    [isAdmin, user]
  );

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [gChordPending, setGChordPending] = useState(false);
  const [gChordFlash, setGChordFlash] = useState(null);
  const sequencePrefixRef = useRef(null);
  const gTimerRef = useRef(null);
  const flashTimerRef = useRef(null);

  const clearSequenceTimer = useCallback(() => {
    if (gTimerRef.current) {
      clearTimeout(gTimerRef.current);
      gTimerRef.current = null;
    }
  }, []);

  const cancelSequence = useCallback(() => {
    clearSequenceTimer();
    sequencePrefixRef.current = null;
    setGChordPending(false);
  }, [clearSequenceTimer]);

  const openPalette = useCallback(() => {
    setHelpOpen(false);
    setPaletteOpen(true);
    cancelSequence();
  }, [cancelSequence]);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
  }, []);

  const togglePalette = useCallback(() => {
    setPaletteOpen((prev) => {
      if (!prev) setHelpOpen(false);
      return !prev;
    });
    cancelSequence();
  }, [cancelSequence]);

  const toggleHelp = useCallback(() => {
    setHelpOpen((prev) => {
      if (!prev) {
        setPaletteOpen(false);
        cancelSequence();
      }
      return !prev;
    });
  }, [cancelSequence]);

  const flashChord = useCallback((message) => {
    setGChordFlash(message);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setGChordFlash(null), 1200);
  }, []);

  const executeAction = useCallback((action) => {
    if (!action) return;

    switch (action.id) {
      case 'palette':
        togglePalette();
        break;
      case 'help':
        toggleHelp();
        break;
      case 'search':
        openPalette();
        break;
      default:
        if (action.quickActionId) {
          invokeShortcutQuickAction(action.quickActionId);
          flashChord(action.label);
        } else if (action.path) {
          flashChord(`→ ${action.label.replace(/^Go to /, '')}`);
          navigate(action.path);
        }
        break;
    }
  }, [togglePalette, toggleHelp, openPalette, navigate, flashChord]);

  const startSequence = useCallback((firstKey) => {
    sequencePrefixRef.current = [firstKey];
    setGChordPending(true);
    clearSequenceTimer();
    gTimerRef.current = setTimeout(() => {
      cancelSequence();
    }, G_CHORD_TIMEOUT_MS);
  }, [clearSequenceTimer, cancelSequence]);

  const completeSequence = useCallback((finalKey) => {
    const prefix = sequencePrefixRef.current || [];
    for (const action of allowedShortcutActions) {
      const binding = bindingsMap[action.id];
      if (!binding?.keys || !isSequenceBinding(binding.keys)) continue;
      if (bindingMatchesSequenceComplete(binding.keys, prefix, finalKey)) {
        cancelSequence();
        executeAction(action);
        return true;
      }
    }

    cancelSequence();
    flashChord(`No shortcut for ${prefix.join(' ')} ${finalKey}`.trim());
    return false;
  }, [bindingsMap, allowedShortcutActions, cancelSequence, executeAction, flashChord]);

  useEffect(() => () => {
    clearSequenceTimer();
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, [clearSequenceTimer]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (isShortcutRecordingActive()) return;

      if (e.key === 'Escape') {
        if (paletteOpen) {
          e.preventDefault();
          closePalette();
          return;
        }
        if (helpOpen) {
          e.preventDefault();
          setHelpOpen(false);
          return;
        }
        if (gChordPending) {
          e.preventDefault();
          cancelSequence();
        }
        return;
      }

      if (paletteOpen || helpOpen) return;

      if (isTypingTarget(e.target)) return;

      if (sequencePrefixRef.current?.length) {
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          completeSequence(e.key.toLowerCase());
        }
        return;
      }

      for (const action of allowedShortcutActions) {
        const binding = bindingsMap[action.id];
        if (!binding?.keys?.length) continue;

        if (isSequenceBinding(binding.keys)) {
          const firstKey = binding.keys[0];
          if (
            e.key.toLowerCase() === firstKey
            && !e.metaKey && !e.ctrlKey && !e.altKey
            && binding.keys.length > 1
          ) {
            e.preventDefault();
            startSequence(firstKey);
            return;
          }
          continue;
        }

        if (eventMatchesCombo(e, binding.keys)) {
          e.preventDefault();
          executeAction(action);
          return;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    paletteOpen,
    helpOpen,
    gChordPending,
    bindingsMap,
    allowedShortcutActions,
    closePalette,
    cancelSequence,
    completeSequence,
    startSequence,
    executeAction,
  ]);

  const value = {
    paletteOpen,
    setPaletteOpen,
    openPalette,
    closePalette,
    togglePalette,
    helpOpen,
    setHelpOpen,
    toggleHelp,
    gChordPending,
    gChordFlash,
    cancelGChord: cancelSequence,
    bindingsMap,
  };

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
