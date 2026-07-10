const Task = require('../models/Task');
const { createTenantRepository } = require('../../../repositories/createTenantRepository');

module.exports = createTenantRepository(Task);
