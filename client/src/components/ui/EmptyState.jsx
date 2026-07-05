import React from 'react';
import { Inbox, Lock } from 'lucide-react';
import { Button } from './primitives';
import { useStaggerReveal } from '../../hooks/transitions';

/**
 * EmptyState — unified empty / no-results placeholder.
 * Icon in teal circle; headline + muted description.
 */
const EmptyState = ({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description,
  action,
  actionLabel,
  onAction,
  lockedReason,
  unlockCta,
  onUnlock,
  variant = 'dashed',
  className = '',
}) => {
  const staggerRef = useStaggerReveal([title, description]);
  const isLocked = Boolean(lockedReason);
  const DisplayIcon = isLocked ? Lock : Icon;

  const variants = {
    dashed: 'border-2 border-dashed border-[var(--color-bg-border)] rounded-[10px] py-16 px-6',
    subtle: 'py-12 px-6',
    compact: 'py-8 px-4',
  };

  return (
    <div
      ref={staggerRef}
      className={`t-stagger text-center ${variants[variant] || variants.dashed} ${className}`}
    >
      {Icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]">
          <DisplayIcon size={22} strokeWidth={2} aria-hidden />
        </div>
      )}
      <p className="t-stagger-line text-sm font-semibold text-[var(--color-text-primary)]">
        {isLocked ? (lockedReason || title) : title}
      </p>
      {description && !isLocked && (
        <p className="t-stagger-line t-stagger-line--2 mt-2 text-xs text-[var(--color-text-muted)] max-w-sm mx-auto">
          {description}
        </p>
      )}
      {(action || (actionLabel && onAction) || (unlockCta && onUnlock)) && (
        <div className="mt-4 flex justify-center">
          {action || (
            <Button size="sm" onClick={isLocked ? onUnlock : onAction}>
              {isLocked ? unlockCta : actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
