import React, { useMemo, useState, isValidElement } from 'react';
import { SlidersHorizontal, MoreVertical } from 'lucide-react';
import { useIsMobile } from '../../hooks/useBreakpoint';
import SearchInput from './SearchInput';
import MobileFilterSheet from './MobileFilterSheet';
import MobileFilterField, { isSearchInputElement, isMobileInlineElement } from './MobileFilterField';

/**
 * Single compact row: title (optional) + filters (children) + actions (right).
 * On mobile: search + inline toggles in toolbar; labeled filters in bottom sheet.
 */
export default function PageToolbar({
  icon: Icon,
  title,
  children,
  actions,
  className = '',
  mobileSearch,
  mobileFilterCount = 0,
  filterSheetTitle = 'Filters',
  onFilterClear,
}) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const childArray = useMemo(() => React.Children.toArray(children), [children]);

  const { inlineSearch, inlineControls, filterChildren } = useMemo(() => {
    if (mobileSearch !== undefined) {
      return {
        inlineSearch: mobileSearch,
        inlineControls: childArray.filter(isMobileInlineElement),
        filterChildren: childArray.filter((c) => !isMobileInlineElement(c)),
      };
    }

    const searchIdx = childArray.findIndex(isSearchInputElement);
    const inline = childArray.filter((c) => isMobileInlineElement(c));
    const filters = childArray.filter((c, i) => i !== searchIdx && !isMobileInlineElement(c));

    return {
      inlineSearch: searchIdx >= 0 ? childArray[searchIdx] : null,
      inlineControls: inline,
      filterChildren: filters,
    };
  }, [childArray, mobileSearch]);

  const activeFilterCount =
    mobileFilterCount ||
    filterChildren.filter((c) => isValidElement(c) && !isSearchInputElement(c)).length;

  if (isMobile) {
    const hasFilters = filterChildren.length > 0;
    const actionNodes = actions ? React.Children.toArray(actions) : [];

    const hasTitle = Icon || title;
    const hasControlsRow = inlineSearch || inlineControls.length > 0;

    const filtersButton = hasFilters ? (
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="relative shrink-0 flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]"
      >
        <SlidersHorizontal size={16} />
        Filters
        {activeFilterCount > 0 && (
          <span className="flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-[var(--color-action-primary)] text-[10px] font-bold text-[var(--color-bg-primary)]">
            {activeFilterCount}
          </span>
        )}
      </button>
    ) : null;

    const primaryActionIndex =
      actionNodes.length > 1
        ? actionNodes.findIndex((node) => isValidElement(node) && node.props?.['data-mobile-primary'])
        : -1;
    const resolvedPrimaryIndex =
      primaryActionIndex >= 0 ? primaryActionIndex : actionNodes.length - 1;
    const primaryAction = actionNodes.length > 0 ? actionNodes[resolvedPrimaryIndex] : null;
    const secondaryActions =
      actionNodes.length > 1
        ? actionNodes.filter((_, i) => i !== resolvedPrimaryIndex)
        : [];

    const overflowMenu = (menuNodes) => (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setActionsOpen((v) => !v)}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]"
          aria-label="More actions"
        >
          <MoreVertical size={18} />
        </button>
        {actionsOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setActionsOpen(false)} aria-hidden />
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] shadow-xl">
              {menuNodes.map((node, i) => (
                <div key={i} className="px-2 py-1" onClick={() => setActionsOpen(false)}>
                  {node}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );

    const actionsNode = actions ? (
      actionNodes.length === 1 ? (
        <div className="shrink-0">{actionNodes[0]}</div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          {primaryAction && <div className="shrink-0">{primaryAction}</div>}
          {secondaryActions.length > 0 && overflowMenu(secondaryActions)}
        </div>
      )
    ) : null;

    const titleBlock = hasTitle ? (
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {Icon && (
          <div className="p-1.5 bg-[var(--color-action-primary)]/10 rounded-lg text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/10 shrink-0">
            <Icon size={16} strokeWidth={2.5} />
          </div>
        )}
        {title && (
          <span className="text-[11px] font-black uppercase tracking-widest text-[var(--color-text-primary)] truncate">
            {title}
          </span>
        )}
      </div>
    ) : null;

    return (
      <>
        <div
          className={`flex flex-col gap-2 min-w-0 p-3 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] overflow-hidden ${className}`}
        >
          {hasTitle ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                {titleBlock}
                {filtersButton && <div className="shrink-0 ml-auto">{filtersButton}</div>}
              </div>
              {hasControlsRow && (
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  {inlineSearch && (
                    <div className="flex-1 min-w-[140px] basis-[min(100%,200px)]">
                      {isValidElement(inlineSearch)
                        ? cloneSearchForMobile(inlineSearch)
                        : inlineSearch}
                    </div>
                  )}
                  {inlineControls.map((control, i) => (
                    <div key={i} className="shrink-0">
                      {control}
                    </div>
                  ))}
                </div>
              )}
              {actionsNode && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-bg-border)]/50">
                  {actionsNode}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              {inlineSearch && (
                <div className="flex-1 min-w-[140px] basis-[min(100%,200px)]">
                  {isValidElement(inlineSearch)
                    ? cloneSearchForMobile(inlineSearch)
                    : inlineSearch}
                </div>
              )}
              {inlineControls.map((control, i) => (
                <div key={i} className="shrink-0">
                  {control}
                </div>
              ))}
              {filtersButton}
              {actionsNode && <div className="shrink-0 ml-auto">{actionsNode}</div>}
            </div>
          )}
        </div>
        {hasFilters && (
          <MobileFilterSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title={filterSheetTitle}
            onApply={() => setSheetOpen(false)}
            onClear={onFilterClear}
          >
            {filterChildren.map((child, i) => (
              <MobileFilterField key={i}>{child}</MobileFilterField>
            ))}
          </MobileFilterSheet>
        )}
      </>
    );
  }

  return (
    <div
      className={`flex flex-nowrap items-center gap-2 min-w-0 p-3 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] overflow-x-auto custom-scrollbar ${className}`}
    >
      {(Icon || title) && (
        <div className="flex items-center gap-2 shrink-0 pr-2 border-r border-[var(--color-bg-border)] mr-1">
          {Icon && (
            <div className="p-1.5 bg-[var(--color-action-primary)]/10 rounded-lg text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/10">
              <Icon size={16} strokeWidth={2.5} />
            </div>
          )}
          {title && (
            <span className="text-[11px] font-black uppercase tracking-widest text-[var(--color-text-primary)] whitespace-nowrap">
              {title}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-nowrap items-center gap-2 min-w-0 flex-1">{children}</div>
      {actions && (
        <div className="flex flex-nowrap items-center gap-2 shrink-0 ml-auto pl-2 border-l border-[var(--color-bg-border)]">
          {actions}
        </div>
      )}
    </div>
  );
}

function cloneSearchForMobile(searchElement) {
  if (!isValidElement(searchElement)) return searchElement;
  const { className = '', ...rest } = searchElement.props || {};
  return React.cloneElement(searchElement, {
    ...rest,
    className: `${className} w-full max-w-full`.replace(/\s*!?w-\[[^\]]+\]/g, '').replace(/\s*shrink[^\s]*/g, '').trim(),
  });
}
