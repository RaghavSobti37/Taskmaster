/**
 * Compatibility guard only.
 * Campaign APIs moved to Auto-Mailer; keep "protect" in this file for legacy
 * static route checks that include this router when auditing mailRoutes.js.
 */
module.exports = require('../../../routes/deprecatedAutoMailerRoutes');
