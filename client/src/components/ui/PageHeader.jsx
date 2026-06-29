import React from 'react';
import { motion } from 'framer-motion';
import AdminConsoleBackButton from '../admin/AdminConsoleBackButton';

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
  const mergedLeading = backTo || leadingActions ? (
    <>
      {backTo && <AdminConsoleBackButton to={backTo} />}
      {leadingActions}
    </>
  ) : null;

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {mergedLeading && (
          <div className="flex items-center gap-2 shrink-0 self-center">
            {mergedLeading}
          </div>
        )}
        <div className="space-y-1 min-w-0 flex-1">
          {showTitle && title && (
            <div className="flex items-center gap-3 min-w-0">
              {Icon && (
                <div className="p-2 bg-[var(--color-action-primary)]/10 rounded-lg text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/10 shrink-0">
                  <Icon size={18} strokeWidth={2.5} />
                </div>
              )}
              <h1 className="tm-page-title uppercase min-w-0">{title}</h1>
            </div>
          )}
          {children}
        </div>
      </div>
      {actions && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-start md:self-center">
          {actions}
        </div>
      )}
    </motion.header>
  );
};

export default PageHeader;
