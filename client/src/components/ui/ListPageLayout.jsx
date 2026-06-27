import React from 'react';
import { PageContainer } from './primitives';
import DataOverviewSection from './DataOverviewSection';
import PageToolbar from './PageToolbar';
import QueryErrorSlot from './QueryErrorSlot';

/**
 * UDIF 2.1 list page: overview → toolbar → workspace (table).
 */
export default function ListPageLayout({
  icon,
  title,
  overview,
  toolbar,
  toolbarActions,
  children,
  className = '',
  containerClassName = '',
  maxWidth,
  overviewMobileCollapsed = true,
  overviewMobileMaxStats = 2,
  mobileFilterCount,
  filterSheetTitle,
  toolbarFill = false,
  overviewSectionClassName = '',
  queryError,
  queryErrorFallback = 'Failed to load data',
  onQueryRetry,
}) {
  const hasOverview =
    overview &&
    ((overview.stats?.length ?? 0) > 0 || (overview.charts?.length ?? 0) > 0);
  const showToolbarTitle = title && !hasOverview;

  return (
    <PageContainer className={containerClassName} maxWidth={maxWidth}>
      <div className={`space-y-3 ${className}`}>
        <QueryErrorSlot
          isError={Boolean(queryError)}
          error={queryError}
          onRetry={onQueryRetry}
          fallback={queryErrorFallback}
        />
        {hasOverview && (
          <DataOverviewSection
            stats={overview.stats}
            charts={overview.charts}
            mobileCollapsed={overview.mobileCollapsed ?? overviewMobileCollapsed}
            mobileMaxStats={overview.mobileMaxStats ?? overviewMobileMaxStats}
            className={overviewSectionClassName}
          />
        )}
        {(toolbar || toolbarActions || showToolbarTitle) && (
          <PageToolbar
            icon={showToolbarTitle ? icon : undefined}
            title={showToolbarTitle ? title : undefined}
            actions={toolbarActions}
            mobileFilterCount={mobileFilterCount}
            filterSheetTitle={filterSheetTitle}
            toolbarFill={toolbarFill}
          >
            {toolbar}
          </PageToolbar>
        )}
        {children}
      </div>
    </PageContainer>
  );
}
