import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useKeyboardShortcuts } from '../contexts/KeyboardShortcutsContext';

export default function GChordHint() {
  const { gChordPending, gChordFlash } = useKeyboardShortcuts();

  const message = gChordFlash || (gChordPending ? 'G — press a letter…' : null);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="fixed bottom-20 left-1/2 z-[2100] -translate-x-1/2 pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-floating)] px-4 py-2 text-xs font-semibold text-[var(--color-text-primary)] shadow-lg">
            <kbd className="mr-2 rounded border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 font-mono text-[10px]">
              {gChordPending && !gChordFlash ? 'G' : '⌨'}
            </kbd>
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
