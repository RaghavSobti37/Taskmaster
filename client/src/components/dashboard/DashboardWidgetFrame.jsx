import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Button } from '../ui/primitives';
import DashboardWidgetShell from '../ui/DashboardWidgetShell';
import { getWidgetRoute, getWidgetLabel } from '../../lib/dashboardSections';

/**
 * Widget chrome with optional navigation, compact cap, and View all.
 */
export default function DashboardWidgetFrame({
  componentId,
  href,
  viewAllHref,
  viewAllLabel = 'View all',
  compact = false,
  maxBodyHeight,
  className = '',
  title,
  icon,
  actions,
  children,
  onNavigate,
}) {
  const navigate = useNavigate();
  const route = href || getWidgetRoute(componentId);
  const displayTitle = title || getWidgetLabel(componentId);

  const go = (path) => {
    if (!path) return;
    if (onNavigate) onNavigate(path);
    else navigate(path);
  };

  const headerTitle = route ? (
    <button
      type="button"
      onClick={() => go(route)}
      className="flex items-center gap-2 text-left hover:text-[var(--color-action-primary)] transition-colors min-w-0"
    >
      <span className="truncate">{displayTitle}</span>
    </button>
  ) : (
    displayTitle
  );

  const viewAll = viewAllHref || route;

  return (
    <DashboardWidgetShell
      className={`h-full ${compact ? 'dashboard-widget--compact' : ''} ${className}`}
      bodyClassName="p-0 flex flex-col flex-1 min-h-0"
      title={headerTitle}
      icon={icon}
      actions={
        <>
          {actions}
          {viewAll && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="!px-2 gap-1 shrink-0"
              onClick={() => go(viewAll)}
            >
              <ExternalLink size={12} />
              <span className="hidden sm:inline">{viewAllLabel}</span>
            </Button>
          )}
        </>
      }
    >
      <div
        role={route ? 'button' : undefined}
        tabIndex={route ? 0 : undefined}
        onClick={route ? () => go(route) : undefined}
        onKeyDown={route ? (e) => { if (e.key === 'Enter') go(route); } : undefined}
        className={`flex-1 min-h-0 overflow-hidden ${route ? 'cursor-pointer' : ''}`}
        style={maxBodyHeight ? { maxHeight: maxBodyHeight } : undefined}
      >
        <div className="h-full overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </DashboardWidgetShell>
  );
}
