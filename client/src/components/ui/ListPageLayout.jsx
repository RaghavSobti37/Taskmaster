import React from 'react';
import { PageContainer } from './primitives';
import DataOverviewSection from './DataOverviewSection';
import PageToolbar from './PageToolbar';

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
}) {
  const hasOverview =
    overview &&
    ((overview.stats?.length ?? 0) > 0 || (overview.charts?.length ?? 0) > 0);
  const showToolbarTitle = title && !hasOverview;

  return (
    <PageContainer className={containerClassName} maxWidth={maxWidth}>
      <div className={`space-y-3 ${className}`}>
        {hasOverview && (
          <DataOverviewSection
            stats={overview.stats}
            charts={overview.charts}
            mobileCollapsed={overview.mobileCollapsed ?? overviewMobileCollapsed}
            mobileMaxStats={overview.mobileMaxStats ?? overviewMobileMaxStats}
          />
        )}
        {(toolbar || toolbarActions || showToolbarTitle) && (
          <PageToolbar
            icon={showToolbarTitle ? icon : undefined}
            title={showToolbarTitle ? title : undefined}
            actions={toolbarActions}
            mobileFilterCount={mobileFilterCount}
            filterSheetTitle={filterSheetTitle}
          >
            {toolbar}
          </PageToolbar>
        )}
        {children}
      </div>
    </PageContainer>
  );
}
