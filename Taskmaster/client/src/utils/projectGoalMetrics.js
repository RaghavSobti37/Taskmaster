export const PROJECT_GOAL_METRIC_KEYS = ['sales', 'totalReach', 'warmLeads', 'audienceExposure'];

export const PROJECT_GOAL_METRIC_LABELS = {
  sales: { label: 'Sales', format: (v) => `₹${Number(v).toLocaleString('en-IN')}` },
  totalReach: { label: 'Total Reach', format: (v) => Number(v).toLocaleString('en-IN') },
  warmLeads: { label: 'Warm Leads', format: (v) => String(v) },
  audienceExposure: { label: 'Audience Exposure', format: (v) => Number(v).toLocaleString('en-IN') },
};

export function formatGoalDelta(delta, meta) {
  if (delta == null || Number.isNaN(delta)) return undefined;
  return {
    direction: delta >= 0 ? 'up' : 'down',
    value: `${delta >= 0 ? '+' : ''}${meta.format(delta)}`,
  };
}

export function buildGoalSparklinePoints(history = [], key, width = 72, height = 22) {
  const rows = [...history].reverse().slice(-8);
  if (rows.length < 2) return null;
  const vals = rows.map((r) => Number(r.values?.[key]) || 0);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  return vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
