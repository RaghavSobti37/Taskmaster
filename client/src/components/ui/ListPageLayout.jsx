import React from 'react';
import DataOverviewSection from './DataOverviewSection';
import DataInsightsLayout from './DataInsightsLayout';
import PageToolbar from './PageToolbar';
import ActiveFilterBar from './ActiveFilterBar';
import SelectionFilterPanel from './SelectionFilterPanel';
import QueryErrorSlot from './QueryErrorSlot';
import AdminConsoleBackButton from '../admin/AdminConsoleBackButton';
import AdminBreadcrumbs from '../admin/AdminBreadcrumbs';
import { useIsMobile } from '../../hooks/useBreakpoint';

/**
 * UDIF 2.1 list page: insights → overview → toolbar → workspace (table).
 */
export default function ListPageLayout({
  icon,
  title,
  backTo,
  insights,
  overview,
  toolbar,
  toolbarActions,
  mobileSearch,
  searchBar,
  filtersInPanel = false,
  children,
  className = '',
  containerClassName = '',
  overviewMobileCollapsed = true,
  overviewMobileMaxStats = 2,
  mobileFilterCount,
  filterSheetTitle,
  filterFields,
  toolbarFill,
  activeFilterChips,
  onActiveFilterRemove,
  onActiveFiltersClear,
  overviewSectionClassName = '',
  queryError,
  queryErrorFallback = 'Failed to load data',
  onQueryRetry,
  header,
  breadcrumbs,
  filterPanelMode = 'overlay',
  filterOpen,
  onFilterOpenChange,
  onFilterApply,
  filterApplyLabel,
}) {
  const hasInsights =
    insights &&
    ((insights.panels?.length ?? 0) > 0 || (insights.charts?.length ?? 0) > 0);
  const hasOverview =
    overview &&
    ((overview.stats?.length ?? 0) > 0 || (overview.charts?.length ?? 0) > 0);
  const isMobile = useIsMobile();
  const hasTopAnalytics = hasInsights || hasOverview;
  const showCompactMobileTitle = isMobile && title && hasTopAnalytics && !backTo;
  const showToolbarTitle = title && (!hasTopAnalytics || showCompactMobileTitle);
  const backLeading = backTo ? <AdminConsoleBackButton to={backTo} /> : null;
  const showOverviewTitleRow = backTo && hasTopAnalytics;
  const resolvedSearchBar = searchBar ?? mobileSearch;
  const resolvedToolbarFill = toolbarFill ?? Boolean(resolvedSearchBar);

  const isPushFilter = filterPanelMode === 'push' && filterFields?.length > 0;
  const showPushPanel = isPushFilter && filterOpen && !isMobile;

  const shellClass = `tm-page-container min-w-0 w-full overflow-x-clip ${containerClassName}`.trim();

  return (
    <div className={shellClass}>
      <div className={`list-page-stack ${className}`.trim()}>
        {header}
        {breadcrumbs?.length > 0 && <AdminBreadcrumbs crumbs={breadcrumbs} />}
        {showOverviewTitleRow && (
          <div className="flex items-center gap-2 min-w-0">
            {backLeading}
            {title && (
              <div className="flex items-center gap-3 min-w-0">
                {icon && (
                  <div className="p-2 bg-[var(--color-action-primary)]/10 rounded-lg text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/10 shrink-0">
                    {React.createElement(icon, { size: 18, strokeWidth: 2.5 })}
                  </div>
                )}
                <h1 className="tm-page-title uppercase min-w-0">{title}</h1>
              </div>
            )}
          </div>
        )}
        <QueryErrorSlot
          isError={Boolean(queryError)}
          error={queryError}
          onRetry={onQueryRetry}
          fallback={queryErrorFallback}
        />
        {hasInsights && (
          <DataInsightsLayout
            panels={insights.panels}
            panelColumns={insights.panelColumns}
            charts={insights.charts}
            chartColumns={insights.chartColumns}
            chartsEager={insights.chartsEager}
          />
        )}
        {hasOverview && (
          <DataOverviewSection
            stats={overview.stats}
            charts={overview.charts}
            eagerCharts={overview.eagerCharts}
            mobileCollapsed={overview.mobileCollapsed ?? overviewMobileCollapsed}
            mobileMaxStats={overview.mobileMaxStats ?? overviewMobileMaxStats}
            className={overviewSectionClassName}
          />
        )}
        {(toolbar || toolbarActions || showToolbarTitle || resolvedSearchBar || filterFields?.length > 0) && (
          <PageToolbar
            icon={showToolbarTitle ? icon : undefined}
            title={showToolbarTitle ? title : undefined}
            leading={backTo && showToolbarTitle ? backLeading : undefined}
            actions={toolbarActions}
            mobileSearch={resolvedSearchBar}
            mobileFilterCount={mobileFilterCount}
            filterSheetTitle={filterSheetTitle}
            toolbarFill={resolvedToolbarFill}
            filtersInPanel={filtersInPanel}
            filterFields={filterFields}
            onFilterClear={onActiveFiltersClear}
            filterOpen={filterOpen}
            onFilterOpenChange={onFilterOpenChange}
            filterPanelMode={filterPanelMode}
            filterApplyLabel={filterApplyLabel}
            onFilterApply={onFilterApply}
          >
            {toolbar}
          </PageToolbar>
        )}
        {showPushPanel ? (
          <div className="flex items-start gap-0 min-w-0">
            <div className="list-page-workspace flex-1 min-w-0">
              {activeFilterChips?.length > 0 && (
                <ActiveFilterBar
                  chips={activeFilterChips}
                  onRemove={onActiveFilterRemove}
                  onClear={onActiveFiltersClear}
                />
              )}
              {children}
            </div>
            <SelectionFilterPanel
              open={filterOpen}
              onClose={() => onFilterOpenChange?.(false)}
              title={filterSheetTitle || 'Filters'}
              fields={filterFields}
              onApply={onFilterApply}
              onClear={onActiveFiltersClear}
              applyLabel={filterApplyLabel || 'Apply'}
              layout="push"
            />
          </div>
        ) : (
          <>
            {activeFilterChips?.length > 0 && (
              <ActiveFilterBar
                chips={activeFilterChips}
                onRemove={onActiveFilterRemove}
                onClear={onActiveFiltersClear}
              />
            )}
            <div className="list-page-workspace">{children}</div>
          </>
        )}
      </div>
    </div>
  );
}
