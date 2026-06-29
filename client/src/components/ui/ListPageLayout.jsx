import React from 'react';
import { PageContainer } from './primitives';
import DataOverviewSection from './DataOverviewSection';
import DataInsightsLayout from './DataInsightsLayout';
import PageToolbar from './PageToolbar';
import QueryErrorSlot from './QueryErrorSlot';
import AdminConsoleBackButton from '../admin/AdminConsoleBackButton';

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
  const hasInsights =
    insights &&
    ((insights.panels?.length ?? 0) > 0 || (insights.charts?.length ?? 0) > 0);
  const hasOverview =
    overview &&
    ((overview.stats?.length ?? 0) > 0 || (overview.charts?.length ?? 0) > 0);
  const hasTopAnalytics = hasInsights || hasOverview;
  const showToolbarTitle = title && !hasTopAnalytics;
  const backLeading = backTo ? <AdminConsoleBackButton to={backTo} /> : null;
  const showOverviewTitleRow = backTo && hasTopAnalytics;

  return (
    <PageContainer className={containerClassName} maxWidth={maxWidth}>
      <div className={`space-y-3 ${className}`}>
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
            className="!space-y-3 mb-0"
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
        {(toolbar || toolbarActions || showToolbarTitle) && (
          <PageToolbar
            icon={showToolbarTitle ? icon : undefined}
            title={showToolbarTitle ? title : undefined}
            leading={backTo && showToolbarTitle ? backLeading : undefined}
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
