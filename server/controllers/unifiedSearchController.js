const UnifiedSearchService = require('../services/UnifiedSearchService');
const { apiError } = require('../utils/apiResponse');

exports.search = async (req, res) => {
  try {
    const q = req.query.q || '';
    const types = req.query.types ? req.query.types.split(',').map((t) => t.trim()) : undefined;
    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 30);
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return apiError(res, 'Tenant required', 400);
    }

    const data = await UnifiedSearchService.unifiedSearch({ tenantId, q, types, limit });
    res.json(data);
  } catch (err) {
    return apiError(res, err.message || 'Search failed', 500);
  }
};
