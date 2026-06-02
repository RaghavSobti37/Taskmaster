import React from 'react';
import { Trash2, Shield } from 'lucide-react';
import { Button } from '../ui';

export default function UserDeleteAction({
  blockReason,
  isPending = false,
  onDelete,
  compact = false,
}) {
  if (blockReason) {
    return (
      <button
        type="button"
        title={blockReason}
        onClick={(e) => {
          e.stopPropagation();
          alert(blockReason);
        }}
        className={`inline-flex items-center gap-1 rounded-md border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] font-bold uppercase tracking-wide text-[var(--color-text-muted)] hover:bg-[var(--color-bg-border)]/40 ${
          compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'
        }`}
      >
        <Shield size={compact ? 12 : 14} />
        Protected
      </button>
    );
  }

  return (
    <Button
      variant="danger"
      size="sm"
      disabled={isPending}
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      className={compact ? '!py-1 !px-2 !text-[10px] uppercase whitespace-nowrap' : 'whitespace-nowrap'}
    >
      <Trash2 size={compact ? 12 : 14} className="mr-1" />
      {isPending ? 'Deleting…' : 'Delete'}
    </Button>
  );
}
