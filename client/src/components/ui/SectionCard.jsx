import React from 'react';
import { Card } from './primitives';

/**
 * SectionCard — card with optional header bar for grouped content.
 */
const SectionCard = ({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClassName = '',
  noPadding = false,
}) => (
  <Card className={`overflow-hidden flex flex-col ${className}`}>
    {(title || actions) && (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
        <div>
          {title && (
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    )}
    <div className={noPadding ? bodyClassName : `p-4 ${bodyClassName}`}>{children}</div>
  </Card>
);

export default SectionCard;
