import React from 'react';
import AdminConsoleBackButton from '../admin/AdminConsoleBackButton';
import { useStaggerReveal } from '../../hooks/transitions';

/**
 * PageHeader — legacy / simple pages without ListPageLayout.
 * UDIF 2.1: prefer ListPageLayout + PageToolbar. Subtitle is deprecated (not rendered).
 */
const PageHeader = ({
  icon: Icon,
  title,
  subtitle: _subtitle,
  showTitle = true,
  backTo,
  leadingActions,
  actions,
  children,
}) => {
  const staggerRef = useStaggerReveal([title, showTitle]);

  const mergedLeading = backTo || leadingActions ? (
    <>
      {backTo && <AdminConsoleBackButton to={backTo} />}
      {leadingActions}
    </>
  ) : null;

  return (
    <header
      ref={staggerRef}
      className="t-stagger flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {mergedLeading && (
          <div className="flex items-center gap-2 shrink-0 self-center">
            {mergedLeading}
          </div>
        )}
        <div className="space-y-1 min-w-0 flex-1">
          {showTitle && title && (
            <div className="t-stagger-line flex items-center gap-3 min-w-0">
              {Icon && (
                <div className="p-2 bg-[var(--color-action-primary)]/10 rounded-lg text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/10 shrink-0">
                  <Icon size={18} strokeWidth={2.5} />
                </div>
              )}
              <h1 className="tm-page-title uppercase min-w-0">{title}</h1>
            </div>
          )}
          {children && <div className="t-stagger-line t-stagger-line--2">{children}</div>}
        </div>
      </div>
      {actions && (
        <div className="t-stagger-line flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-start md:self-center">
          {actions}
        </div>
      )}
    </header>
  );
};

export default PageHeader;
