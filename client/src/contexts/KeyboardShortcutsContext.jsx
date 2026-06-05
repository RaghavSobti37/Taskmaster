import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isAdminUser } from '../utils/departmentPermissions';
import {
  G_CHORD_TIMEOUT_MS,
  isModKey,
  isTypingTarget,
  resolveGChord,
} from '../lib/keyboardShortcuts';

const KeyboardShortcutsContext = createContext(null);

export function KeyboardShortcutsProvider({ children }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [gChordPending, setGChordPending] = useState(false);
  const [gChordFlash, setGChordFlash] = useState(null);
  const gTimerRef = useRef(null);
  const flashTimerRef = useRef(null);

  const clearGTimer = useCallback(() => {
    if (gTimerRef.current) {
      clearTimeout(gTimerRef.current);
      gTimerRef.current = null;
    }
  }, []);

  const cancelGChord = useCallback(() => {
    clearGTimer();
    setGChordPending(false);
  }, [clearGTimer]);

  const openPalette = useCallback(() => {
    setHelpOpen(false);
    setPaletteOpen(true);
    cancelGChord();
  }, [cancelGChord]);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
  }, []);

  const togglePalette = useCallback(() => {
    setPaletteOpen((prev) => {
      if (!prev) setHelpOpen(false);
      return !prev;
    });
    cancelGChord();
  }, [cancelGChord]);

  const toggleHelp = useCallback(() => {
    setHelpOpen((prev) => {
      if (!prev) {
        setPaletteOpen(false);
        cancelGChord();
      }
      return !prev;
    });
  }, [cancelGChord]);

  const flashChord = useCallback((message) => {
    setGChordFlash(message);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setGChordFlash(null), 1200);
  }, []);

  const runGChord = useCallback((key) => {
    const route = resolveGChord(key, { isAdmin });
    cancelGChord();
    if (route?.path) {
      flashChord(`→ ${route.label}`);
      navigate(route.path);
      return true;
    }
    flashChord(`No shortcut for G+${key.toUpperCase()}`);
    return false;
  }, [isAdmin, navigate, cancelGChord, flashChord]);

  const startGChord = useCallback(() => {
    setGChordPending(true);
    clearGTimer();
    gTimerRef.current = setTimeout(() => {
      setGChordPending(false);
      gTimerRef.current = null;
    }, G_CHORD_TIMEOUT_MS);
  }, [clearGTimer]);

  useEffect(() => () => {
    clearGTimer();
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, [clearGTimer]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (isModKey(e) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePalette();
        return;
      }

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
          cancelGChord();
        }
        return;
      }

      if (paletteOpen || helpOpen) return;

      if (isTypingTarget(e.target)) return;

      if (e.key === '?' && !isModKey(e) && !e.altKey) {
        e.preventDefault();
        toggleHelp();
        return;
      }

      if (e.key === '/' && !isModKey(e) && !e.altKey) {
        e.preventDefault();
        openPalette();
        return;
      }

      if (e.key.toLowerCase() === 'g' && !isModKey(e) && !e.altKey && !gChordPending) {
        e.preventDefault();
        startGChord();
        return;
      }

      if (gChordPending && !isModKey(e) && !e.altKey) {
        if (e.key.length === 1) {
          e.preventDefault();
          runGChord(e.key.toLowerCase());
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    paletteOpen,
    helpOpen,
    gChordPending,
    togglePalette,
    toggleHelp,
    openPalette,
    closePalette,
    cancelGChord,
    startGChord,
    runGChord,
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
    cancelGChord,
  };

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const ctx = useContext(KeyboardShortcutsContext);
  if (!ctx) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
  }
  return ctx;
}
