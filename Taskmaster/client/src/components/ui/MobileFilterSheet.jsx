import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from './primitives';

/**
 * Bottom sheet for mobile filter controls — vertical scroll only, labeled fields.
 */
export default function MobileFilterSheet({ open, onClose, title = 'Filters', children, onApply, onClear }) {
  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('mobile-scroll-lock');
    return () => {
      document.body.classList.remove('mobile-scroll-lock');
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[70] lg:hidden"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[71] lg:hidden bg-[var(--color-bg-primary)] border-t border-[var(--color-bg-border)] rounded-t-2xl shadow-2xl max-h-[min(85vh,640px)] flex flex-col pb-[env(safe-area-inset-bottom)]"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[var(--color-bg-border)]" aria-hidden />
            </div>
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-bg-border)] shrink-0">
              <h2 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-primary)]">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close filters"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-5 custom-scrollbar min-h-0">
              {children}
            </div>
            <div className="flex gap-2 p-4 border-t border-[var(--color-bg-border)] shrink-0 bg-[var(--color-bg-primary)]">
              {onClear && (
                <Button variant="secondary" className="flex-1 min-h-[48px]" onClick={onClear}>
                  Clear all
                </Button>
              )}
              <Button className="flex-1 min-h-[48px]" onClick={onApply || onClose}>
                Apply
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
