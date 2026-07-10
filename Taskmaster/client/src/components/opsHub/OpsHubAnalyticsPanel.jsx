import React, { useMemo } from 'react';
import DataOverviewSection from '../ui/DataOverviewSection';

export default function OpsHubAnalyticsPanel({ analytics }) {
  const stats = useMemo(() => {
    if (!analytics) return [];
    const t = analytics.totals || {};
    return [
      { id: 'total', label: 'Total records', value: t.entities ?? 0, variant: 'info' },
      { id: 'touched', label: 'Updated this week', value: t.touchedThisWeek ?? 0, variant: 'mint' },
      { id: 'new', label: 'New this week', value: t.newThisWeek ?? 0, variant: 'success' },
      { id: 'sections', label: 'Sections submitted', value: `${t.submittedSections ?? 0}/${t.totalSections ?? 4}`, variant: 'warning' },
    ];
  }, [analytics]);

  const charts = useMemo(() => {
    if (!analytics) return [];
    const out = [];
    if (analytics.byDomain?.length) {
      out.push({
        id: 'domain',
        title: 'By domain',
        type: 'donut',
        data: analytics.byDomain.map((d) => ({ label: d.label, value: d.count })),
      });
    }
    if (analytics.byStatus?.length) {
      out.push({
        id: 'status',
        title: 'By status',
        type: 'bar',
        data: analytics.byStatus.map((d) => ({ label: d.key, value: d.count })),
      });
    }
    return out;
  }, [analytics]);

  if (!analytics) return null;

  return <DataOverviewSection stats={stats} charts={charts} className="mb-4" eagerCharts />;
}
