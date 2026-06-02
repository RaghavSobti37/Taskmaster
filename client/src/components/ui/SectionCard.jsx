import React from 'react';

/**
 * SectionCard — flat section with optional header bar (border dividers, no card shadow).
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
  <section className={`flex flex-col border-t border-[var(--color-bg-border)] ${className}`}>
    {(title || actions) && (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-[var(--color-bg-border)]">
        <div>
          {title && (
            <h3 className="tm-widget-label text-[var(--color-text-primary)]">
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
    <div className={noPadding ? bodyClassName : `py-4 ${bodyClassName}`}>{children}</div>
  </section>
);

export default SectionCard;
