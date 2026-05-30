const { startOfDay, endOfDay } = require('date-fns');

const FOLLOWUP_DATE_FIELD = {
  followupDate: {
    $dateFromString: {
      dateString: '$nextFollowupDate',
      onError: null,
      onNull: null,
    },
  },
};

const followupDateExistsStage = { $match: { followupDate: { $ne: null } } };

const buildFollowupTabMatch = (tab) => {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  if (tab === 'today') {
    return { $match: { followupDate: { $gte: todayStart, $lte: todayEnd } } };
  }
  if (tab === 'overdue') {
    return { $match: { followupDate: { $lt: todayStart } } };
  }
  if (tab === 'upcoming') {
    return { $match: { followupDate: { $gt: todayEnd } } };
  }
  return null;
};

const buildFollowupStatsGroupStage = () => {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  return {
    $group: {
      _id: null,
      today: {
        $sum: {
          $cond: [
            { $and: [{ $gte: ['$followupDate', todayStart] }, { $lte: ['$followupDate', todayEnd] }] },
            1,
            0,
          ],
        },
      },
      overdue: {
        $sum: {
          $cond: [{ $lt: ['$followupDate', todayStart] }, 1, 0],
        },
      },
      upcoming: {
        $sum: {
          $cond: [{ $gt: ['$followupDate', todayEnd] }, 1, 0],
        },
      },
    },
  };
};

module.exports = {
  FOLLOWUP_DATE_FIELD,
  followupDateExistsStage,
  buildFollowupTabMatch,
  buildFollowupStatsGroupStage,
};
