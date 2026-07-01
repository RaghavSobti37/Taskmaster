import React from 'react';
import AdminConsoleBackButton from '../admin/AdminConsoleBackButton';
import { useStaggerReveal } from '../../hooks/transitions';

/**
 * PageHeader — [icon box] TITLE [optional desc] [primary action].
 * Prefer ListPageLayout for list pages; use this for simple/utility views.
 */
const PageHeader = ({
  icon: Icon,
  title,
  subtitle,
  description,
  showTitle = true,
  backTo,
  leadingActions,
  actions,
  children,
}) => {
  const desc = description ?? subtitle;
  const staggerRef = useStaggerReveal([title, showTitle, desc]);

  return (
    <header
      ref={staggerRef}
      className="t-stagger flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {backTo && <AdminConsoleBackButton to={backTo} />}
        {leadingActions}
        {Icon && (
          <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-lg bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/10">
            <Icon size={18} strokeWidth={2.5} aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          {showTitle && title && (
            <h1 className="t-stagger-line tm-page-title uppercase min-w-0 m-0">{title}</h1>
          )}
          {desc && (
            <p className="t-stagger-line t-stagger-line--2 text-xs text-[var(--color-text-muted)] m-0">
              {desc}
            </p>
          )}
          {children && <div className="t-stagger-line">{children}</div>}
        </div>
      </div>
      {actions && (
        <div className="t-stagger-line flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
};

export default PageHeader;
