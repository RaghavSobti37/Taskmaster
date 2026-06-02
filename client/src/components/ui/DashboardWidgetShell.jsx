import React from 'react';
import { Card } from './primitives';

/**
 * Standard dashboard widget chrome — flat surface, uniform header band, cell border.
 */
export default function DashboardWidgetShell({
  title,
  icon: Icon,
  actions,
  children,
  className = '',
  bodyClassName = 'p-4',
  headerClassName = '',
}) {
  return (
    <Card className={`dashboard-widget p-0 flex flex-col h-full min-h-0 overflow-hidden ${className}`}>
      {(title || actions) && (
        <div
          className={`dashboard-widget-header px-4 h-11 min-h-[44px] w-full border-b border-[var(--color-bg-border)] flex items-center justify-between gap-2 shrink-0 box-border ${headerClassName}`}
        >
          {title ? (
            typeof title === 'string' ? (
              <h4 className="tm-widget-label mb-0 flex items-center gap-2 min-w-0 truncate">
                {Icon && <Icon size={14} strokeWidth={2.5} className="text-[var(--color-text-muted)] shrink-0" />}
                <span className="truncate">{title}</span>
              </h4>
            ) : (
              <div className="tm-widget-label mb-0 flex items-center gap-2 min-w-0 flex-1">
                {Icon && <Icon size={14} strokeWidth={2.5} className="text-[var(--color-text-muted)] shrink-0" />}
                <div className="min-w-0 flex-1">{title}</div>
              </div>
            )
          ) : (
            <span className="flex-1 min-w-0" aria-hidden />
          )}
          {actions && <div className="flex items-center gap-2 shrink-0 ml-auto">{actions}</div>}
        </div>
      )}
      <div className={`flex-1 min-h-0 overflow-hidden ${bodyClassName}`}>{children}</div>
    </Card>
  );
}
