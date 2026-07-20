const deprecatedAutoMailerRoutes = require('../../routes/deprecatedAutoMailerRoutes');

/** Compatibility exports only. Mail and campaign APIs moved to Auto-Mailer. */
module.exports = {
  mail: deprecatedAutoMailerRoutes,
  campaigns: deprecatedAutoMailerRoutes,
};
