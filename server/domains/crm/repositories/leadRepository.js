const Lead = require('../models/Lead');
const { createTenantRepository } = require('../../../repositories/createTenantRepository');

module.exports = createTenantRepository(Lead);
