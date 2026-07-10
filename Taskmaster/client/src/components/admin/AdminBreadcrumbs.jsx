import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ADMIN_CONSOLE_PATH } from './AdminConsoleBackButton';

/**
 * @param {{ crumbs?: { label: string, path?: string }[] }} props
 * crumbs — e.g. [{ label: 'Users' }] → Admin > Users
 */
export default function AdminBreadcrumbs({ crumbs = [] }) {
  if (!crumbs.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] mb-2 flex-wrap">
      <Link to={ADMIN_CONSOLE_PATH} className="hover:text-[var(--color-text-primary)] font-semibold uppercase tracking-wide">
        Admin
      </Link>
      {crumbs.map((crumb, index) => (
        <React.Fragment key={`${crumb.label}-${index}`}>
          <ChevronRight size={10} className="opacity-50 shrink-0" aria-hidden />
          {crumb.path ? (
            <Link to={crumb.path} className="hover:text-[var(--color-text-primary)] font-semibold uppercase tracking-wide truncate max-w-[12rem]">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-[var(--color-text-secondary)] font-semibold uppercase tracking-wide truncate max-w-[12rem]">
              {crumb.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
