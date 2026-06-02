/**
 * Build small chart series for DataOverviewSection (client-side aggregation).
 */

const DEFAULT_TOP_N = 8;

export function distributionFromField(rows, field, { topN = DEFAULT_TOP_N, labelFn } = {}) {
  if (!Array.isArray(rows) || !field) return [];
  const counts = new Map();
  for (const row of rows) {
    const raw = row?.[field];
    const label = labelFn ? labelFn(raw, row) : (raw == null || raw === '' ? 'Other' : String(raw));
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const sorted = [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  if (sorted.length <= topN) return sorted;
  const head = sorted.slice(0, topN - 1);
  const rest = sorted.slice(topN - 1).reduce((s, x) => s + x.value, 0);
  return [...head, { label: 'Other', value: rest }];
}

export function timeBucketsFromDate(rows, dateKey, { days = 7 } = {}) {
  if (!Array.isArray(rows) || !dateKey) return [];
  const now = new Date();
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: 0,
      _key: key,
    });
  }
  const keyToIdx = Object.fromEntries(buckets.map((b, i) => [b._key, i]));
  for (const row of rows) {
    const raw = row?.[dateKey];
    if (!raw) continue;
    const key = new Date(raw).toISOString().slice(0, 10);
    const idx = keyToIdx[key];
    if (idx != null) buckets[idx].value += 1;
  }
  return buckets.map(({ label, value }) => ({ label, value }));
}

export function mapKpisToStats(kpis, iconMap = {}) {
  if (!Array.isArray(kpis)) return [];
  return kpis.slice(0, 4).map((kpi) => ({
    id: kpi.key,
    label: kpi.label,
    value:
      kpi.format === 'percent'
        ? `${kpi.value}%`
        : kpi.format === 'currency'
          ? `₹${Number(kpi.value).toLocaleString('en-IN')}`
          : kpi.value,
    icon: iconMap[kpi.key],
    variant: kpi.variant || 'info',
  }));
}
