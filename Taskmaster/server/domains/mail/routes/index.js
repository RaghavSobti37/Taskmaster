/**
 * Campaign, template, profile, and newsletter mail routes live in Auto-Mailer.
 * Keep this compatibility router as a hard guard for accidental remounts.
 */
module.exports = require('../../../routes/deprecatedAutoMailerRoutes');
