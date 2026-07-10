import React from 'react';
import { Edit2, History } from 'lucide-react';

export default function LeadRowActions({ onEdit, onHistory }) {
  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--token-surface-1)]/90 pl-2 rounded-l-md">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.();
        }}
        className="p-1.5 rounded-md hover:bg-[var(--token-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        title="Edit lead"
        aria-label="Edit lead"
      >
        <Edit2 size={14} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onHistory?.();
        }}
        className="p-1.5 rounded-md hover:bg-[var(--token-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        title="Audit history"
        aria-label="Audit history"
      >
        <History size={14} />
      </button>
    </div>
  );
}
