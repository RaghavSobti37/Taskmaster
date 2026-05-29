import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './primitives';

/**
 * EmptyState — unified empty / no-results placeholder.
 * Replaces inline dashed-border blocks across ProjectsView, OfficeAssetsPage, etc.
 */
const EmptyState = ({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description,
  action,
  actionLabel,
  onAction,
  variant = 'dashed',
  className = '',
}) => {
  const variants = {
    dashed: 'border-2 border-dashed border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] py-16 px-6',
    subtle: 'py-12 px-6',
    compact: 'py-8 px-4',
  };

  return (
    <div className={`text-center ${variants[variant] || variants.dashed} ${className}`}>
      {Icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
          <Icon size={22} strokeWidth={2} />
        </div>
      )}
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
        {title}
      </p>
      {description && (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
          {description}
        </p>
      )}
      {(action || (actionLabel && onAction)) && (
        <div className="mt-4 flex justify-center">
          {action || (
            <Button size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
