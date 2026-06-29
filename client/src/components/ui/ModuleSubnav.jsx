import React from 'react';
import { NavLink } from 'react-router-dom';

const tabBase =
  'inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 rounded-md transition-colors';
const tabActive = 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]';
const tabInactive =
  'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]/50';

function TabBadge({ badge, badgeVariant }) {
  if (!badge || badge <= 0) return null;
  const tone =
    badgeVariant === 'warning'
      ? 'bg-amber-500 text-[var(--color-bg-primary)]'
      : badgeVariant === 'overdue'
        ? 'bg-rose-500 text-white'
        : 'bg-[var(--color-action-primary)] text-[var(--color-bg-primary)]';
  return (
    <span
      className={`flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[8px] font-bold tabular-nums ${tone}`}
    >
      {badge > 99 ? '99+' : badge}
    </span>
  );
}

function ItemContent({ icon: Icon, label, badge, badgeVariant }) {
  return (
    <>
      {Icon && <Icon size={12} className="shrink-0 opacity-75" strokeWidth={2} aria-hidden />}
      <span>{label}</span>
      <TabBadge badge={badge} badgeVariant={badgeVariant} />
    </>
  );
}

function renderAction(action) {
  if (!action) return null;
  const ActionIcon = action.icon;
  const actionClass =
    'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[var(--color-action-primary)] text-white hover:opacity-90 transition-opacity whitespace-nowrap shrink-0';

  if (action.to) {
    return (
      <NavLink to={action.to} className={actionClass}>
        {ActionIcon && <ActionIcon size={14} aria-hidden />}
        <span>{action.label}</span>
      </NavLink>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={actionClass}>
      {ActionIcon && <ActionIcon size={14} aria-hidden />}
      <span>{action.label}</span>
    </button>
  );
}

/**
 * Merged toolbar subnav (option D): module title, icon tabs, optional action — one row on desktop.
 */
export default function ModuleSubnav({
  title,
  titleIcon: TitleIcon,
  items,
  mode = 'route',
  activeId,
  onTabChange,
  action,
  ariaLabel = 'Section navigation',
  className = '',
}) {
  const renderRouteItem = (item) => (
    <NavLink
      key={item.id}
      to={item.to}
      end={item.end}
      className={({ isActive }) => `${tabBase} ${isActive ? tabActive : tabInactive}`}
    >
      <ItemContent {...item} />
    </NavLink>
  );

  const renderTabItem = (item) => {
    const active = item.id === activeId;
    return (
      <button
        key={item.id}
        type="button"
        role="tab"
        aria-selected={active}
        aria-controls={item.panelId || `hub-panel-${item.id}`}
        id={item.tabId || `hub-tab-${item.id}`}
        onClick={() => onTabChange?.(item.id)}
        className={`${tabBase} ${active ? tabActive : tabInactive}`}
      >
        <ItemContent {...item} />
      </button>
    );
  };

  return (
    <div className={`flex flex-col lg:flex-row lg:items-center gap-3 min-w-0 py-1 ${className}`}>
      {title && (
        <div className="flex items-center gap-2 shrink-0">
          {TitleIcon && (
            <div className="p-1.5 rounded-lg bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]">
              <TitleIcon size={16} aria-hidden />
            </div>
          )}
          <span className="text-sm font-bold tracking-tight">{title}</span>
        </div>
      )}

      <nav
        role={mode === 'tabs' ? 'tablist' : 'navigation'}
        aria-label={ariaLabel}
        className="flex gap-1 overflow-x-auto custom-scrollbar min-w-0 flex-1 lg:justify-center"
      >
        {items.map(mode === 'route' ? renderRouteItem : renderTabItem)}
      </nav>

      {action && <div className="shrink-0 lg:ml-auto">{renderAction(action)}</div>}
    </div>
  );
}
