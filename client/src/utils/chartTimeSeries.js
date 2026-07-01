/** Map dashboard API series rows to Bklit time-series points (real Date x-axis). */
export function mapDashboardSeriesToChart(rows, valueKey = 'count') {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const iso = String(row.date || row._id || '').slice(0, 10);
    const date = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? new Date(`${iso}T12:00:00+05:30`)
      : new Date();
    return {
      date,
      value: Number(row[valueKey] ?? row.count ?? row.value ?? 0),
      label: row.label,
    };
  });
}

export function chartTicksForTimeframe(timeframe) {
  if (timeframe === '1d') return 2;
  if (timeframe === '7d') return 4;
  return 5;
}
