import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal } from 'lucide-react';
import { useIsMobile } from '../../hooks/useBreakpoint';
import MobileFilterSheet from './MobileFilterSheet';
import FilterFields from './FilterFields';
import { Button } from './primitives';

/**
 * Reusable selection filter panel — replaces toolbar NexusDropdown filters app-wide.
 *
 * ## API
 * | Prop | Type | Description |
 * |------|------|-------------|
 * | `open` | boolean | Panel visibility |
 * | `onClose` | () => void | Close without apply side-effects |
 * | `title` | string | Panel heading (default "Filters") |
 * | `fields` | FieldConfig[] | `{ id, label, type, options?, value, onChange, defaultValue?, searchable?, hidden? }` |
 * | `onApply` | () => void | Apply footer action (default: onClose) |
 * | `onClear` | () => void | Clear all footer action |
 *
 * ## Field types
 * - `radio` — single-select option list (default)
 * - `searchable` — radio list with search when many options
 * - `chips` — multi-select chip row
 * - `segmented` — inline segmented control (e.g. view mode)
 * - `toggle` — boolean (e.g. starred only)
 * - `dateRange` — `{ start, end }` date inputs
 *
 * ## Migration pattern
 * Keep `SearchInput` in PageToolbar children; move dropdown filters to `filterFields` on ListPageLayout.
 * Use `countActiveFilters(filterFields)` for badge count. Optional chips via `ActiveFilterBar`.
 *
 * Mobile: bottom sheet (MobileFilterSheet). Desktop: right drawer.
 */
export default function SelectionFilterPanel({
  open,
  onClose,
  title = 'Filters',
  fields = [],
  onApply,
  onClear,
  applyLabel = 'Apply',
  layout = 'overlay',
}) {
  const isMobile = useIsMobile();
  const handleApply = onApply || onClose;
  const isPush = layout === 'push' && !isMobile;

  useEffect(() => {
    if (isMobile || !open || isPush) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('mobile-scroll-lock');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('mobile-scroll-lock');
    };
  }, [isMobile, open, onClose, isPush]);

  const panelBody = (
    <>
      <div className={`flex-1 overflow-y-auto overflow-x-hidden p-4 custom-scrollbar min-h-0 ${isPush ? 'max-h-[calc(100vh-14rem)]' : ''}`}>
        <FilterFields fields={fields} columns={3} compact />
        {isPush && (
          <div
            className="sticky bottom-0 left-0 right-0 h-6 -mb-4 pointer-events-none bg-gradient-to-t from-[var(--color-bg-primary)] to-transparent"
            aria-hidden
          />
        )}
      </div>
      <div className="flex gap-2 p-4 border-t border-[var(--color-bg-border)] shrink-0 bg-[var(--color-bg-primary)]">
        {onClear && (
          <Button variant="secondary" className="flex-1 min-h-[48px]" onClick={onClear}>
            Clear all
          </Button>
        )}
        <Button className="flex-1 min-h-[48px]" onClick={handleApply}>
          {applyLabel}
        </Button>
      </div>
    </>
  );

  if (isPush && open) {
    return (
      <aside
        className="hidden lg:flex w-[30vw] min-w-[280px] max-w-[520px] shrink-0 sticky top-4 self-start flex-col max-h-[calc(100vh-6rem)] bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] shadow-lg ml-4"
        role="dialog"
        aria-modal="false"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-bg-border)] shrink-0">
          <h2 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close filters"
          >
            <X size={18} />
          </button>
        </div>
        {panelBody}
      </aside>
    );
  }

  if (isMobile) {
    return (
      <MobileFilterSheet
        open={open}
        onClose={onClose}
        title={title}
        onApply={handleApply}
        onClear={onClear}
      >
        <FilterFields fields={fields} columns={3} compact />
      </MobileFilterSheet>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[70] hidden lg:block"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="fixed top-0 right-0 bottom-0 z-[71] hidden lg:flex w-[30vw] min-w-[280px] max-w-[520px] flex-col bg-[var(--color-bg-primary)] border-l border-[var(--color-bg-border)] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-bg-border)] shrink-0">
              <h2 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-primary)]">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close filters"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 custom-scrollbar min-h-0">
              <FilterFields fields={fields} columns={3} compact />
            </div>
            <div className="flex gap-2 p-4 border-t border-[var(--color-bg-border)] shrink-0 bg-[var(--color-bg-primary)]">
              {onClear && (
                <Button variant="secondary" className="flex-1 min-h-[48px]" onClick={onClear}>
                  Clear all
                </Button>
              )}
              <Button className="flex-1 min-h-[48px]" onClick={handleApply}>
                {applyLabel}
              </Button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Filters toolbar trigger — badge shows active count from `countActiveFilters(fields)`.
 */
export function FilterToolbarButton({ activeCount = 0, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-filter-toolbar-button
      className={`relative shrink-0 flex items-center gap-1.5 px-3 min-h-[44px] lg:h-9 lg:min-h-[2.25rem] lg:max-h-[2.25rem] box-border rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)] hover:border-[var(--color-action-primary)]/40 transition-colors ${className}`}
    >
      <SlidersHorizontal size={16} aria-hidden />
      Filters
      {activeCount > 0 && (
        <span className="flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-[var(--color-action-primary)] text-[10px] font-bold text-[var(--color-bg-primary)]">
          {activeCount}
        </span>
      )}
    </button>
  );
}
