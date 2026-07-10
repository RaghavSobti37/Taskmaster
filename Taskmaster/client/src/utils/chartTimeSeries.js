const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse dashboard `YYYY-MM-DD` keys as noon IST so x-scale and tooltips stay aligned. */
export function parseDashboardSeriesDate(row) {
  const iso = String(row?.date || row?._id || '').slice(0, 10);
  return iso && ISO_DATE_RE.test(iso)
    ? new Date(`${iso}T12:00:00+05:30`)
    : new Date();
}

/** Map dashboard API series rows to Bklit time-series points (real Date x-axis). */
export function mapDashboardSeriesToChart(rows, valueKey = 'count') {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    date: parseDashboardSeriesDate(row),
    value: Number(row[valueKey] ?? row.count ?? row.value ?? 0),
    label: row.label,
  }));
}

/** Attach a real Date x-axis to dashboard rows while preserving existing metrics. */
export function mapDashboardSeriesWithDate(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({ ...row, date: parseDashboardSeriesDate(row) }));
}

export function chartTicksForTimeframe(timeframe) {
  if (timeframe === '1d') return 2;
  if (timeframe === '7d') return 4;
  return 5;
}
