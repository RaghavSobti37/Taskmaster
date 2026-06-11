const models = require('./models');

/** Cross-domain auth/user entry points. */
module.exports = {
  ...models,
  User: models.User,
};
