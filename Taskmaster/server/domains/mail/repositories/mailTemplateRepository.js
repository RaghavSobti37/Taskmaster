const MailTemplate = require('../models/MailTemplate');
const { createTenantRepository } = require('../../../repositories/createTenantRepository');

module.exports = createTenantRepository(MailTemplate);
