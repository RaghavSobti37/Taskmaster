const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');

const getDefaultSeedPassword = () =>
  (process.env.DEFAULT_SEED_PASSWORD || DEV_DEFAULT_PASSWORD).trim();

module.exports = {
  DEV_DEFAULT_PASSWORD,
  getDefaultSeedPassword,
};
