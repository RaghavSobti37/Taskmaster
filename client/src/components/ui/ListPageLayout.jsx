import React from 'react';
import { PageContainer } from './primitives';
import DataOverviewSection from './DataOverviewSection';
import DataInsightsLayout from './DataInsightsLayout';
import PageToolbar from './PageToolbar';
import ActiveFilterBar from './ActiveFilterBar';
import QueryErrorSlot from './QueryErrorSlot';
import AdminConsoleBackButton from '../admin/AdminConsoleBackButton';
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
  maxWidth,
  overviewMobileCollapsed = true,
  overviewMobileMaxStats = 2,
  mobileFilterCount,
  filterSheetTitle,
  filterFields,
  toolbarFill = false,
  activeFilterChips,
  onActiveFilterRemove,
  onActiveFiltersClear,
  overviewSectionClassName = '',
  queryError,
  queryErrorFallback = 'Failed to load data',
  onQueryRetry,
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

  return (
    <PageContainer className={containerClassName} maxWidth={maxWidth}>
      <div className={`list-page-stack ${className}`.trim()}>
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
            toolbarFill={toolbarFill}
            filtersInPanel={filtersInPanel}
            filterFields={filterFields}
            onFilterClear={onActiveFiltersClear}
          >
            {toolbar}
          </PageToolbar>
        )}
        {activeFilterChips?.length > 0 && (
          <ActiveFilterBar
            chips={activeFilterChips}
            onRemove={onActiveFilterRemove}
            onClear={onActiveFiltersClear}
          />
        )}
        <div className="list-page-workspace">{children}</div>
      </div>
    </PageContainer>
  );
}
