/**
 * Map Data Hub analytics API payload → DataOverviewSection chart configs.
 */
export function buildDataHubOverviewCharts(analytics, folder = 'all') {
  if (!analytics || folder !== 'all') return [];

  const charts = [];

  if (analytics.inletBreakdown?.length) {
    charts.push({
      id: 'inlet-mix',
      title: 'People by Inlet',
      type: analytics.inletBreakdown.length <= 6 ? 'donut' : 'bar',
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
      type: 'bar',
      data: analytics.emailHealth.map((row) => ({
        label: row.status || 'Unknown',
        value: Number(row.count) || 0,
      })),
    });
  }

  if (analytics.growth?.length) {
    charts.push({
      id: 'weekly-growth',
      title: 'Weekly Growth',
      type: 'bar',
      data: analytics.growth.map((row) => ({
        label: row._id || row.label || '—',
        value: Number(row.count) || 0,
      })),
    });
  }

  return charts;
}
