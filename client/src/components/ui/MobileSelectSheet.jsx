import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Search, X } from 'lucide-react';
import { Button } from './primitives';

/**
 * Native-style bottom sheet picker for mobile — replaces floating dropdown menus.
 */
export default function MobileSelectSheet({
  open,
  onClose,
  title = 'Select',
  options = [],
  value,
  onChange,
  searchable = false,
  search = '',
  onSearchChange,
  renderOption,
  isSelected,
  onSelect,
  multiSelect = false,
}) {
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('mobile-scroll-lock');
    return () => {
      document.body.classList.remove('mobile-scroll-lock');
    };
  }, [open]);

  useEffect(() => {
    if (!open || !searchable) return undefined;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open, searchable]);

  const filteredOptions = searchable && search
    ? options.filter((opt) => {
        const hay = String(opt.searchKey || opt.label || '').toLowerCase();
        return hay.includes(search.toLowerCase());
      })
    : options;

  const handlePick = (option) => {
    onSelect(option);
    if (!multiSelect) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99998] lg:hidden"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[99999] lg:hidden bg-[var(--color-bg-primary)] border-t border-[var(--color-bg-border)] rounded-t-2xl shadow-2xl max-h-[min(88vh,720px)] flex flex-col pb-[env(safe-area-inset-bottom)]"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[var(--color-bg-border)]" aria-hidden />
            </div>
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-bg-border)] shrink-0">
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {searchable && (
              <div className="px-4 py-3 border-b border-[var(--color-bg-border)] shrink-0">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    ref={searchRef}
                    type="search"
                    inputMode="search"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={search}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    placeholder="Search..."
                    className="mobile-form-control w-full pl-10 pr-3 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-base outline-none focus:border-[var(--color-action-primary)]"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <p className="px-4 py-8 text-center text-base text-[var(--color-text-muted)]">No matches</p>
              ) : (
                <ul className="py-2">
                  {filteredOptions.map((option) => {
                    const selected = isSelected(option.value);
                    return (
                      <li key={option.value}>
                        <button
                          type="button"
                          onClick={() => handlePick(option)}
                          className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 min-h-[52px] text-left transition-colors ${
                            selected
                              ? 'bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]'
                              : 'text-[var(--color-text-primary)] active:bg-[var(--color-bg-secondary)]'
                          }`}
                        >
                          <span className="min-w-0 flex-1 text-base leading-snug">
                            {renderOption ? renderOption(option) : option.label}
                          </span>
                          {selected && <Check size={20} className="shrink-0 text-[var(--color-action-primary)]" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {multiSelect && (
              <div className="p-4 border-t border-[var(--color-bg-border)] shrink-0">
                <Button className="w-full min-h-[48px] text-base" onClick={onClose}>
                  Done
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
