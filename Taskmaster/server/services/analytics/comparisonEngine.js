const Task = require('../../domains/tasks/models/Task');

/** @typedef {{ start: Date, end: Date }} Period */

/**
 * @typedef {(tenantId: import('mongoose').Types.ObjectId | string | null | undefined, period: Period) => Promise<number>} MetricAdapter
 */

/** @type {Record<string, MetricAdapter>} */
const METRIC_ADAPTERS = {
  tasks_completed: async (tenantId, period) => {
    const filter = {
      status: 'done',
      completedAt: { $gte: period.start, $lte: period.end },
    };
    let query = Task.countDocuments(filter);
    if (tenantId) query = query.setOptions({ tenantId });
    return query;
  },
};

const computeTrend = (delta) => {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
};

const computeDeltaPercent = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 10000) / 100;
};

/**
 * Compare a metric across two time periods.
 *
 * @param {{ metric: string, tenantId?: import('mongoose').Types.ObjectId | string | null, currentPeriod: Period, previousPeriod: Period }} params
 * @returns {Promise<{ current: number, previous: number, delta: number, deltaPercent: number, trend: 'up' | 'down' | 'flat' }>}
 */
async function comparePeriods({ metric, tenantId, currentPeriod, previousPeriod }) {
  const adapter = METRIC_ADAPTERS[metric];
  if (!adapter) {
    throw new Error(`Unknown metric: ${metric}`);
  }

  const [current, previous] = await Promise.all([
    adapter(tenantId, currentPeriod),
    adapter(tenantId, previousPeriod),
  ]);

  const delta = current - previous;

  return {
    current,
    previous,
    delta,
    deltaPercent: computeDeltaPercent(current, previous),
    trend: computeTrend(delta),
  };
}

module.exports = {
  comparePeriods,
  METRIC_ADAPTERS,
  computeTrend,
  computeDeltaPercent,
};
