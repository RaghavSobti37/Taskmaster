import { useContext } from 'react';
import { KeyboardShortcutsContext } from '../contexts/keyboardShortcutsContext.shared';

export function useKeyboardShortcuts() {
  const ctx = useContext(KeyboardShortcutsContext);
  if (!ctx) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
  }
  return ctx;
}
