import React, { useMemo, useState, isValidElement, cloneElement } from 'react';
import { MoreVertical } from 'lucide-react';
import { useIsMobile } from '../../hooks/useBreakpoint';
import SearchInput from './SearchInput';
import NexusDropdown from './NexusDropdown';
import StatusSelect from '../forms/StatusSelect';
import PrioritySelect from '../forms/PrioritySelect';
import ProjectSelect from '../forms/ProjectSelect';
import MobileFilterSheet from './MobileFilterSheet';
import MobileFilterField, { isSearchInputElement } from './MobileFilterField';
import SelectionFilterPanel, { FilterToolbarButton } from './SelectionFilterPanel';
import { countActiveFilters } from './selectionFilterUtils';
import {
  flattenToolbarChildren,
  partitionToolbarChildren,
  shouldInlineMobileSearchWithAction,
  shouldShowActionsInMobileSearchRow,
} from './toolbarMobilePartition';

const TOOLBAR_FIELD_TYPES = new Set([
  SearchInput,
  NexusDropdown,
  StatusSelect,
  PrioritySelect,
  ProjectSelect,
]);

function normalizeToolbarChild(child) {
  if (!isValidElement(child)) return child;
  if (!TOOLBAR_FIELD_TYPES.has(child.type)) return child;
  if (child.props?.variant === 'toolbar') return child;
  return cloneElement(child, { variant: 'toolbar' });
}

/**
 * Single compact row: title (optional) + filters (children) + actions (right).
 * When `filterFields` is set, toolbar shows Filters button + SelectionFilterPanel (mobile sheet / desktop drawer).
 * Search stays outside via `mobileSearch` or first toolbar child marked as search.
 */
export default function PageToolbar({
  icon: Icon,
  title,
  leading,
  children,
  actions,
  className = '',
  mobileSearch,
  mobileFilterCount = 0,
  filterSheetTitle = 'Filters',
  filterFields,
  onFilterClear,
  toolbarFill = false,
  filtersInPanel = false,
}) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const usesConfigPanel = Array.isArray(filterFields) && filterFields.length > 0;
  const usePanel = usesConfigPanel || filtersInPanel;

  const childArray = useMemo(() => React.Children.toArray(children), [children]);
  const flatChildren = useMemo(() => flattenToolbarChildren(children), [children]);

  const { inlineSearch, inlineControls, filterChildren } = useMemo(
    () => partitionToolbarChildren(flatChildren, mobileSearch),
    [flatChildren, mobileSearch],
  );

  const configActiveCount = usesConfigPanel ? countActiveFilters(filterFields) : 0;
  const legacyActiveCount = filterChildren.filter((c) => isValidElement(c) && !isSearchInputElement(c)).length;
  const activeFilterCount = mobileFilterCount || configActiveCount || legacyActiveCount;

  const desktopChildren = useMemo(
    () => childArray.map(normalizeToolbarChild),
    [childArray],
  );

  const hasLegacyFilters = !usesConfigPanel && filterChildren.some((c) => !isSearchInputElement(c));
  const hasFilters = usesConfigPanel || hasLegacyFilters;

  const filtersButton = hasFilters ? (
    <FilterToolbarButton activeCount={activeFilterCount} onClick={() => setSheetOpen(true)} />
  ) : null;

  const panel = usesConfigPanel ? (
    <SelectionFilterPanel
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
      title={filterSheetTitle}
      fields={filterFields}
      onApply={() => setSheetOpen(false)}
      onClear={onFilterClear}
    />
  ) : hasLegacyFilters ? (
    <MobileFilterSheet
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
      title={filterSheetTitle}
      onApply={() => setSheetOpen(false)}
      onClear={onFilterClear}
    >
      {filterChildren
        .filter((child) => !isSearchInputElement(child))
        .map((child, i) => (
          <MobileFilterField key={i}>{child}</MobileFilterField>
        ))}
    </MobileFilterSheet>
  ) : null;

  if (isMobile) {
    const actionNodes = actions ? React.Children.toArray(actions) : [];

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
          className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)]"
          aria-label="More actions"
        >
          <MoreVertical size={18} />
        </button>
        {actionsOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setActionsOpen(false)} aria-hidden />
            <div className="tm-floating absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] shadow-xl">
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

    const hasTitle = Icon || title;
    const hasInlineControls = inlineControls.length > 0;
    const inlineSearchWithAction = shouldInlineMobileSearchWithAction({
      inlineSearch,
      hasFilters,
      inlineControlCount: inlineControls.length,
      actionCount: actionNodes.length,
    });
    const actionsInSearchRow = shouldShowActionsInMobileSearchRow({
      inlineSearch,
      inlineSearchWithAction,
      actionCount: actionNodes.length,
    });

    const mobileRightCluster =
      (hasFilters && filtersButton) || (actionsInSearchRow && actionsNode) ? (
        <div className="page-toolbar-right flex items-center gap-2 shrink-0">
          {hasFilters && filtersButton}
          {actionsInSearchRow && actionsNode}
        </div>
      ) : null;

    const mobileSearchFiltersRow = inlineSearch ? (
      <div className="tm-mobile-search-row sticky top-0 z-20 -mx-1 px-1 py-1 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm border-b border-[var(--color-bg-border)]/80 flex items-center gap-2 min-w-0">
        <div className="page-toolbar-search flex-1 min-w-0">
          {isValidElement(inlineSearch)
            ? cloneSearchForMobile(inlineSearch)
            : inlineSearch}
        </div>
        {mobileRightCluster}
      </div>
    ) : null;

    const standaloneActionsRow =
      !inlineSearch && (filtersButton || actionsNode) ? (
        <div className="flex items-center gap-2 min-w-0">
          {filtersButton}
          {actionsNode && <div className="shrink-0 ml-auto">{actionsNode}</div>}
        </div>
      ) : null;

    const titleBlock = hasTitle ? (
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {leading && <div className="shrink-0">{leading}</div>}
        {Icon && (
          <div className="flex items-center justify-center w-9 h-9 rounded-[var(--radius-atomic)] bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/10 shrink-0">
            <Icon size={16} strokeWidth={2.5} />
          </div>
        )}
        {title && (
          <span className="tm-widget-label truncate normal-case tracking-[0.08em]">
            {title}
          </span>
        )}
      </div>
    ) : null;

    return (
      <>
        <div
          className={`flex flex-col gap-2 min-w-0 pb-3 border-b border-[var(--color-bg-border)] overflow-hidden ${className}`}
        >
          {hasTitle ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                {titleBlock}
              </div>
              {mobileSearchFiltersRow}
              {hasInlineControls && (
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  {inlineControls.map((control, i) => (
                    <div key={i} className="shrink-0">
                      {control}
                    </div>
                  ))}
                </div>
              )}
              {standaloneActionsRow}
            </>
          ) : (
            <>
              {leading && (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="shrink-0">{leading}</div>
                </div>
              )}
              {mobileSearchFiltersRow}
              {hasInlineControls && (
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  {inlineControls.map((control, i) => (
                    <div key={i} className="shrink-0">
                      {control}
                    </div>
                  ))}
                </div>
              )}
              {standaloneActionsRow}
            </>
          )}
        </div>
        {panel}
      </>
    );
  }

  const desktopWrap = toolbarFill;
  const showDesktopFilterButton = usePanel && hasFilters;
  const searchFromProp = mobileSearch !== undefined;
  const hasDesktopSearchSlot = Boolean(
    inlineSearch && (searchFromProp || showDesktopFilterButton),
  );
  const desktopSearchNode = hasDesktopSearchSlot ? (
    <div className="page-toolbar-search flex-1 min-w-0">
      {normalizeSearchForGrow(inlineSearch)}
    </div>
  ) : null;

  const legacyDesktopPanel = !usesConfigPanel && filtersInPanel && hasLegacyFilters ? (
    <SelectionFilterPanel
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
      title={filterSheetTitle}
      onApply={() => setSheetOpen(false)}
      onClear={onFilterClear}
      fields={filterChildren
        .filter((child) => !isSearchInputElement(child))
        .map((child, i) => {
          const label = child.props?.label || child.props?.placeholder || child.props?.['data-filter-label'] || `Filter ${i + 1}`;
          return {
            id: `legacy-${i}`,
            label,
            type: 'custom',
            render: () => <MobileFilterField label={label}>{child}</MobileFilterField>,
          };
        })}
    />
  ) : null;

  return (
    <>
      <div
        className={`page-toolbar-row flex items-center gap-2 min-w-0 min-h-[44px] py-2 border-b border-[var(--color-bg-border)] ${
          desktopWrap ? 'flex-wrap' : 'flex-nowrap overflow-x-auto custom-scrollbar'
        } ${className}`}
      >
        {(leading || Icon || title) && (
          <div className="flex items-center gap-2 shrink-0 pr-3 h-9 border-r border-[var(--color-bg-border)]">
            {leading && <div className="shrink-0">{leading}</div>}
            {Icon && (
              <div className="flex items-center justify-center w-9 h-9 rounded-[var(--radius-atomic)] bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/10 shrink-0">
                <Icon size={16} strokeWidth={2.5} />
              </div>
            )}
            {title && (
              <span className="tm-widget-label whitespace-nowrap normal-case tracking-[0.08em]">
                {title}
              </span>
            )}
          </div>
        )}
        {hasDesktopSearchSlot ? (
          desktopSearchNode
        ) : (
          <div
            className={`page-toolbar-controls flex items-center gap-x-2 gap-y-2 min-w-0 flex-1 ${
              toolbarFill ? 'page-toolbar-controls--fill flex-wrap' : 'flex-nowrap'
            }`}
          >
            {desktopChildren}
          </div>
        )}
        {(showDesktopFilterButton || actions) && (
          <div className="page-toolbar-right flex flex-nowrap items-center gap-2 shrink-0 pl-3 h-9 border-l border-[var(--color-bg-border)]">
            {showDesktopFilterButton && (
              <>
                {inlineControls.map((control, i) => (
                  <div key={i} className="shrink-0">
                    {control}
                  </div>
                ))}
                {filtersButton}
              </>
            )}
            {actions && <div className="page-toolbar-actions flex flex-nowrap items-center gap-2">{actions}</div>}
          </div>
        )}
      </div>
      {usesConfigPanel && panel}
      {legacyDesktopPanel}
    </>
  );
}

function normalizeSearchForGrow(searchElement) {
  const normalized = normalizeToolbarChild(searchElement);
  if (!isValidElement(normalized) || !isSearchInputElement(normalized)) return normalized;
  const { className = '' } = normalized.props || {};
  return cloneElement(normalized, {
    className: `${className} tm-toolbar-search--grow`.trim(),
  });
}

function cloneSearchForMobile(searchElement) {
  if (!isValidElement(searchElement)) return searchElement;
  const { className = '', label, variant, ...rest } = searchElement.props || {};
  return React.cloneElement(searchElement, {
    ...rest,
    label: undefined,
    variant: variant === 'ghost' ? 'ghost' : 'toolbar',
    'data-mobile-search': true,
    className: `${className} w-full max-w-full !min-w-0`
      .replace(/\s*!?w-\[[^\]]+\]/g, '')
      .replace(/\s*shrink[^\s]*/g, '')
      .trim(),
  });
}
