/**
 * Map Data Hub analytics API payload → DataOverviewSection chart configs.
 */

export const EMAIL_HEALTH_BAR_COLORS = {
  Active: 'var(--color-success, #14b8a6)',
  Pending: '#f59e0b',
  Bounced: '#f43f5e',
  Invalid: '#f43f5e',
  Unsubscribed: '#94a3b8',
};

export function emailStatusChartColor(status) {
  return EMAIL_HEALTH_BAR_COLORS[status] || 'var(--color-action-primary)';
}

export function buildDataHubOverviewCharts(analytics, folder = 'all') {
  if (!analytics || folder !== 'all') return [];

  const charts = [];

  if (analytics.inletBreakdown?.length) {
    charts.push({
      id: 'inlet-mix',
      title: 'People by Inlet',
      type: 'horizontalBar',
      emptyLabel: 'No inlet data yet',
      data: analytics.inletBreakdown.map((row) => ({
        label: row.label || row.key,
        value: Number(row.count) || 0,
      })),
    });
  }

  if (analytics.emailHealth?.length) {
    charts.push({
      id: 'email-health',
      title: 'Email Health',
      type: 'horizontalBar',
      emptyLabel: 'No email status data yet',
      data: analytics.emailHealth.map((row) => ({
        label: row.status || 'Unknown',
        value: Number(row.count) || 0,
        color: emailStatusChartColor(row.status),
      })),
    });
  }

  if (analytics.growth?.length) {
    charts.push({
      id: 'weekly-growth',
      title: 'Weekly Growth',
      type: 'bar',
      emptyLabel: 'No growth data yet',
      data: analytics.growth.map((row) => ({
        label: row._id || row.label || '—',
        value: Number(row.count) || 0,
      })),
    });
  }

  return charts;
}
