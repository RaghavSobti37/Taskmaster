import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isAdminUser } from '../utils/departmentPermissions';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { mergeShortcutBindings } from '../lib/shortcutDefaultsShared';
import { buildShortcutSectionsForUser, filterShortcutSections } from '../lib/keyboardShortcuts';
import { filterActionsByPageAccess } from '../utils/navPageAccess';
import { NAV_ACTIONS } from '../lib/shortcutDefaultsShared';
import { useShortcutPreferences } from '../hooks/useShortcutPreferences';

export default function KeyboardShortcutsOverlay() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts();
  const { data: shortcutPrefs } = useShortcutPreferences(!!user);

  const sections = useMemo(() => {
    const bindingsMap = shortcutPrefs?.effectiveBindings
      || mergeShortcutBindings(shortcutPrefs?.bindings);
    const allowedNavIds = new Set(
      filterActionsByPageAccess(NAV_ACTIONS, user).map((action) => action.id)
    );
    return filterShortcutSections(
      buildShortcutSectionsForUser(bindingsMap, { isAdmin }),
      { isAdmin }
    )
      .map((section) => (
        section.items.some((item) => String(item.id).startsWith('nav-'))
          ? { ...section, items: section.items.filter((item) => allowedNavIds.has(item.id)) }
          : section
      ))
      .filter((section) => section.items.length > 0);
  }, [shortcutPrefs, isAdmin, user]);

  return (
    <AnimatePresence>
      {helpOpen && (
        <motion.div
          className="fixed inset-0 z-[2050] flex items-center justify-center bg-black/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setHelpOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <motion.div
            className="w-full max-w-lg rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-floating)] shadow-2xl"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                <Keyboard size={16} aria-hidden />
                Keyboard shortcuts
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
                aria-label="Close shortcuts"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-4 py-3 space-y-4">
              {sections.map((section) => (
                <div key={section.title}>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                    {section.title}
                  </h3>
                  {section.subtitle && (
                    <p className="text-[10px] text-[var(--color-text-muted)] mb-2">{section.subtitle}</p>
                  )}
                  <ul className="text-sm space-y-1">
                    {section.items.map((row) => (
                      <li key={row.id} className="flex items-center justify-between gap-4 py-1">
                        <span className="text-[var(--color-text-muted)]">{row.label}</span>
                        <kbd className="shrink-0 rounded border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 font-mono text-xs text-[var(--color-text-primary)]">
                          {row.display}
                        </kbd>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <p className="border-t border-[var(--color-bg-border)] px-4 py-2 text-xs text-[var(--color-text-muted)]">
              Customize in Settings → Shortcuts. Shortcuts are disabled while typing in inputs. Press Esc to cancel a sequence or close this panel.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
