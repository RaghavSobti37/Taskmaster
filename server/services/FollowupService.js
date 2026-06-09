const Lead = require('../models/Lead');
const paginatedQuery = require('../utils/paginatedQuery');
const { applyCrmScopeToQuery } = require('../utils/crmScope');

class FollowupService {
  /**
   * Retrieves paginated followups using the CQRS separation logic.
   */
  static async getPaginatedFollowups(user, queryParams = {}) {
    const query = { nextFollowupDate: { $exists: true, $ne: '' } };
    applyCrmScopeToQuery(query, user, queryParams);

    const result = await paginatedQuery(Lead, query, {
      page: queryParams.page || 1,
      limit: queryParams.limit || 50,
      sort: { nextFollowupDate: 1 },
      populate: { path: 'assignedRepId', select: 'name avatar' }
    });

    const followups = result.data.map(l => ({
      ...l,
      date: l.nextFollowupDate,
      time: l.nextFollowupTime,
      status: l.callStatus === 'Connected' || l.leadStatus === 'Converted' ? 'Completed' : 'Pending',
      assignedRep: l.assignedRepId
    }));

    return {
      data: followups,
      pagination: result.pagination
    };
  }
}

module.exports = FollowupService;
