const UnifiedSearchService = require('../services/UnifiedSearchService');

exports.search = async (req, res) => {
  try {
    const q = req.query.q || '';
    const types = req.query.types ? req.query.types.split(',').map((t) => t.trim()) : undefined;
    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 30);
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant required' });
    }

    const data = await UnifiedSearchService.unifiedSearch({ tenantId, q, types, limit });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Search failed' });
  }
};
