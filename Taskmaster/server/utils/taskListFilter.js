const { getDateKey, startOfDayFromKey } = require('./attendanceDate');

const COMPLETED_VISIBLE_DAYS = 2;

const shiftDateKey = (dateKey, days) => {
  const anchor = startOfDayFromKey(dateKey);
  anchor.setDate(anchor.getDate() + days);
  return getDateKey(anchor);
};

/** Start of app-timezone day at the oldest calendar day still shown for completed tasks. */
const getCompletedTasksCutoff = () => {
  const todayKey = getDateKey();
  const oldestVisibleKey = shiftDateKey(todayKey, -(COMPLETED_VISIBLE_DAYS - 1));
  return startOfDayFromKey(oldestVisibleKey);
};

/**
 * Keep open tasks; for status "done", keep only those completed (or updated) on/after cutoff.
 * Matches dashboard stats fallback when completedAt is missing.
 */
const buildActiveOrRecentCompletedClause = (cutoff = getCompletedTasksCutoff()) => ({
  $or: [
    { status: { $ne: 'done' } },
    {
      status: 'done',
      $or: [
        { completedAt: { $gte: cutoff } },
        {
          $and: [
            { $or: [{ completedAt: null }, { completedAt: { $exists: false } }] },
            { updatedAt: { $gte: cutoff } },
          ],
        },
      ],
    },
  ],
});

const mergeTaskListFilter = (filter = {}, { includeOldCompleted = false } = {}) => {
  if (includeOldCompleted) return filter;
  const visibility = buildActiveOrRecentCompletedClause();
  if (!filter || Object.keys(filter).length === 0) return visibility;
  return { $and: [filter, visibility] };
};

module.exports = {
  COMPLETED_VISIBLE_DAYS,
  getCompletedTasksCutoff,
  buildActiveOrRecentCompletedClause,
  mergeTaskListFilter,
};
