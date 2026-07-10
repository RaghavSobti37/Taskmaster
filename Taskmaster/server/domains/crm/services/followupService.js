const FollowupService = require('./legacyFollowupService');

async function getFollowups(user, queryParams = {}) {
  return FollowupService.getPaginatedFollowups(user, queryParams);
}

function applyFollowupPaginationHeaders(res, pagination) {
  res.set('X-Total-Count', pagination.total);
  res.set('X-Total-Pages', pagination.pages);
  res.set('X-Current-Page', pagination.page);
  res.set('Access-Control-Expose-Headers', 'X-Total-Count, X-Total-Pages, X-Current-Page');
}

module.exports = {
  getFollowups,
  applyFollowupPaginationHeaders,
};
