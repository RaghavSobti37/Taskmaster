const Tenant = require('../models/Tenant');

const tenantMiddleware = async (req, res, next) => {
  try {
    // Determine tenantId from request headers or subdomain
    // For MVP, we look for 'x-tenant-id' in the headers.
    const tenantId = req.headers['x-tenant-id'];

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required for this action.' });
    }

    // Verify tenant exists and is active
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }
    if (tenant.status !== 'active' && tenant.status !== 'trial') {
      return res.status(403).json({ error: 'Tenant account is inactive.' });
    }

    // Append tenantId to the request object so subsequent routes can use it
    req.tenantId = tenantId;
    next();
  } catch (error) {
    console.error('Tenant Middleware Error:', error);
    res.status(500).json({ error: 'Failed to process tenant information.' });
  }
};

module.exports = tenantMiddleware;
