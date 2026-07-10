const models = require('./models');
const googleController = require('./controllers/googleController');

/** Cross-domain integrations entry points. */
module.exports = {
  ...models,
  linkProjectCalendar: googleController.linkProjectCalendar,
  getProjectCalendarEvents: googleController.getProjectCalendarEvents,
  linkGoogleAccount: googleController.linkGoogleAccount,
};
