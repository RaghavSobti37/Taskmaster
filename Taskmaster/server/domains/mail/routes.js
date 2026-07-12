/** Thin domain route exports — mount mail + campaign APIs separately in registerRoutes */
module.exports = {
  mail: require('./routes/index'),
  campaigns: require('./routes/campaignApiRouter'),
};
