const models = require('./models');
const dashboardController = require('./controllers/dashboardController');

/** Cross-domain dashboard entry points. */
module.exports = {
  ...models,
  getDashboardSummary: dashboardController.getDashboardSummary,
  getDepartmentStats: dashboardController.getDepartmentStats,
  getAttendanceOverview: dashboardController.getAttendanceOverview,
};
