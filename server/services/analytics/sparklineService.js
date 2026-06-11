const { METRIC_ADAPTERS } = require('./comparisonEngine');

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Daily sparkline buckets for a metric over the last N days (inclusive of today).
 *
 * @param {string} metric
 * @param {import('mongoose').Types.ObjectId | string | null | undefined} tenantId
 * @param {number} [days=7]
 * @returns {Promise<{ metric: string, days: number, points: Array<{ date: string, value: number }> }>}
 */
async function getSparkline(metric, tenantId, days = 7) {
  const adapter = METRIC_ADAPTERS[metric];
  if (!adapter) {
    throw new Error(`Unknown metric: ${metric}`);
  }

  const span = Math.max(1, Math.min(Number(days) || 7, 90));
  const anchor = startOfDay(new Date());
  const points = [];

  for (let offset = span - 1; offset >= 0; offset -= 1) {
    const day = new Date(anchor);
    day.setDate(day.getDate() - offset);
    const start = startOfDay(day);
    const end = endOfDay(day);
    const value = await adapter(tenantId, { start, end });
    points.push({ date: start.toISOString().slice(0, 10), value });
  }

  return { metric, days: span, points };
}

module.exports = { getSparkline };
