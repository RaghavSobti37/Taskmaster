const Project = require('../models/Project');
const { createTenantRepository } = require('../../../repositories/createTenantRepository');

module.exports = createTenantRepository(Project);
