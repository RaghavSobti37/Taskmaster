import React, { useLayoutEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSlidingTabs } from '../../hooks/transitions';

const tabBase =
  't-tab inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[44px] lg:min-h-0 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 rounded-md transition-colors';
const tabActive = 'is-active text-[var(--tabs-text-active)]';
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
      <span className="relative inline-flex shrink-0 items-center justify-center">
        {Icon && <Icon size={12} className="shrink-0 opacity-75" strokeWidth={2} aria-hidden />}
      </span>
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
  tabsFitContent = false,
  className = '',
}) {
  const location = useLocation();
  const { barRef, pillRef, movePill } = useSlidingTabs();

  useLayoutEffect(() => {
    movePill(true);
  }, [activeId, location.pathname, items.length, movePill]);

  const renderRouteItem = (item) => {
    const classNameFn = ({ isActive }) => `${tabBase} ${isActive ? tabActive : tabInactive}`;
    return (
      <NavLink key={item.id} to={item.to} end={item.end} className={classNameFn}>
        <ItemContent {...item} />
      </NavLink>
    );
  };

  const renderButtonItem = (item) => {
    const isActive = activeId === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onTabChange?.(item.id)}
        className={`${tabBase} ${isActive ? tabActive : tabInactive}`}
      >
        <ItemContent {...item} />
      </button>
    );
  };

  return (
    <nav
      className={`tm-module-subnav flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between ${className}`}
      aria-label={ariaLabel}
    >
      {(title || TitleIcon) && (
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          {TitleIcon && <TitleIcon size={16} className="shrink-0 text-[var(--color-action-primary)]" aria-hidden />}
          {title && (
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-primary)] truncate">
              {title}
            </h2>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 min-w-0 flex-1 lg:justify-end">
        <div
          ref={barRef}
          className={`tm-sliding-tabs relative flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--color-bg-secondary)]/60 overflow-x-auto ${tabsFitContent ? 'w-fit max-w-full' : 'w-full lg:w-auto'}`}
        >
          <span ref={pillRef} className="tm-sliding-tabs-pill" aria-hidden />
          {items.map((item) => (mode === 'route' ? renderRouteItem(item) : renderButtonItem(item)))}
        </div>
        {renderAction(action)}
      </div>
    </nav>
  );
}
