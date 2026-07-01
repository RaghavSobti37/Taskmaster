/** Normalize chart rows so Bklit time-series charts get real Date x values. */
export function normalizeTimeSeriesRows(rows, xKey = 'date') {
  if (!Array.isArray(rows)) return [];
  return rows.map((row, index) => {
    const raw = row?.[xKey];
    let date = raw;
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
      date = raw;
    } else if (typeof raw === 'string' || typeof raw === 'number') {
      const parsed = new Date(raw);
      date = Number.isNaN(parsed.getTime())
        ? new Date(Date.now() - (rows.length - 1 - index) * 86_400_000)
        : parsed;
    } else {
      date = new Date(Date.now() - (rows.length - 1 - index) * 86_400_000);
    }
    return { ...row, [xKey]: date };
  });
}

export const BK_CHART_MARGIN = { top: 8, right: 12, bottom: 32, left: 40 };

export const BK_LINE_COLORS = {
  primary: 'var(--chart-line-primary)',
  mint: 'var(--color-pastel-mint-text)',
  apricot: 'var(--color-pastel-apricot-text)',
  blue: 'var(--color-pastel-blue-text)',
  rose: 'var(--color-pastel-rose-text)',
  brand: 'var(--color-action-primary)',
  teal: 'var(--color-brand-teal)',
  sky: '#38bdf8',
  emerald: '#10b981',
};

/** Map label/value rows to Bklit categorical bar `name` + `value` fields. */
export function toCategoryBarRows(rows, labelKey = 'label', valueKey = 'value') {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    ...row,
    name: String(row[labelKey] ?? row.name ?? ''),
    value: Number(row[valueKey] ?? row.count ?? 0),
  }));
}

export function seriesHasValues(rows, keys) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  return rows.some((row) => keyList.some((key) => Number(row?.[key]) > 0));
}
