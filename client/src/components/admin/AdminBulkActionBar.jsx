import React from 'react';
import { Button } from '../ui';

export default function AdminBulkActionBar({
  selectedCount,
  onClear,
  children,
  className = '',
}) {
  if (!selectedCount) return null;

  return (
    <div
      className={`sticky bottom-3 z-20 mx-auto max-w-3xl rounded-[var(--radius-atomic)] border border-[var(--color-action-primary)]/30 bg-[var(--color-bg-primary)]/95 backdrop-blur px-4 py-3 shadow-lg flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}
      role="region"
      aria-label="Bulk actions"
    >
      <p className="text-xs font-semibold text-[var(--color-text-primary)]">
        {selectedCount} selected
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {children}
        <Button type="button" variant="secondary" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
