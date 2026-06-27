import React, { useState } from 'react';
import MailStatsSummary from '../../components/admin/MailStatsSummary';
import MailCumulativeAnalyticsPanel from '../../components/admin/MailCumulativeAnalyticsPanel';
import MailLocationLeadsModal from '../../components/admin/MailLocationLeadsModal';
import { useMailStats, useCumulativeAnalytics } from '../../hooks/useTaskmasterQueries';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';
import QueryErrorBanner, { getQueryErrorMessage } from '../../components/ui/QueryErrorBanner';

export default function EmailsAnalyticsPage() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const {
    data: stats,
    isError: statsError,
    error: statsErr,
    refetch: refetchStats,
  } = useMailStats();
  const deferCumulative = useDeferredQueryEnabled(true, { tier: 0 });
  const {
    data: cumulativeAnalytics,
    isError: cumulativeError,
    error: cumulativeErr,
    refetch: refetchCumulative,
  } = useCumulativeAnalytics(deferCumulative);

  return (
    <div className="space-y-6">
      {statsError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(statsErr, 'Failed to load mail stats')}
          onRetry={() => refetchStats()}
        />
      )}
      {cumulativeError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(cumulativeErr, 'Failed to load analytics')}
          onRetry={() => refetchCumulative()}
        />
      )}
      <div>
        <h2 className="text-base font-bold tracking-tight">Aggregate Analytics</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          Cross-campaign engagement, geography, and tag performance
        </p>
      </div>
      <MailStatsSummary stats={stats} />
      <MailCumulativeAnalyticsPanel
        cumulativeAnalytics={cumulativeAnalytics}
        onLocationSelect={setSelectedLocation}
      />
      {selectedLocation && (
        <MailLocationLeadsModal
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
        />
      )}
    </div>
  );
}
