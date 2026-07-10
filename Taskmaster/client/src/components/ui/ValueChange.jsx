import React from 'react';
import { ArrowRight } from 'lucide-react';

const SIZE_CLASS = {
  sm: 'text-[10px]',
  md: 'text-xs',
};

/**
 * ValueChange — old → new delta display (strikethrough prior, teal successor).
 * Use for audit trails, history rows, and inline field modifications.
 */
export default function ValueChange({
  oldValue,
  newValue,
  className = '',
  size = 'sm',
  emptyLabel = '(empty)',
}) {
  const textSize = SIZE_CLASS[size] || SIZE_CLASS.sm;

  return (
    <div className={`flex items-center gap-2 max-w-md min-w-0 ${textSize} ${className}`.trim()}>
      <span className="text-[var(--color-text-muted)] line-through truncate min-w-0 flex-1">
        {oldValue || emptyLabel}
      </span>
      <ArrowRight size={12} className="text-[var(--color-text-muted)] shrink-0" aria-hidden />
      <span className="text-[var(--color-action-primary)] font-bold truncate min-w-0 flex-1">
        {newValue || emptyLabel}
      </span>
    </div>
  );
}
