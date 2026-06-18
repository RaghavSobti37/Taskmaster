/**
 * Central policy for when bypassTenant is permitted.
 * Routes/services should use repositories/tenantQuery helpers instead of raw bypassTenant.
 */

const ROUTE_ALLOWLIST = new Set([
  'track.js',
  'campaignRoutes.js',
  'campaignApiRouter.js',
  'calendarRoutes.js',
]);

const SERVICE_ALLOWLIST = new Set([
  'DataHubService.js',
  'artistPathHubService.js',
  'artistEnquiryService.js',
  'newsletterAudienceService.js',
  'ContactService.js',
  'PersonHubBuilder.js',
  'PersonIdentityService.js',
  'UnifiedSearchService.js',
  'subscriptionReminderService.js',
  'crmReachOutDigestService.js',
  'crmDigestSettingsService.js',
  'leadWriteService.js',
  'leadDuplicateService.js',
  'campaignFacade.js',
  'folderCache.js',
  'resendWebhookHandler.js',
  'queueService.js',
  'emailProcessor.js',
]);

/** Controllers/middleware that bypass before tenant context exists or for break-glass ops. */
const CONTROLLER_ALLOWLIST = new Set([
  'authController.js',
  'userController.js',
  'authMiddleware.js',
  'financeController.js',
  'campaignApiController.js',
  'dashboardController.js',
]);

/** Worker/utils with documented cross-tenant or pre-context bypass. */
const UTIL_ALLOWLIST = new Set([
  'refreshAttendanceMetrics.js',
  'authUserLookup.js',
  'ensureDevAdminUser.js',
  'primaryCallAssignee.js',
  'platformOwner.js',
  'campaignRegisteredLocation.js',
  'artistEnquiryProjectResolver.js',
  'resolveCampaignTenantId.js',
]);

const USE_CASES = {
  TRACKING: 'email open/click/bounce events cross-tenant',
  CAMPAIGN_RESOLVE: 'public campaign lookup by campaignId',
  DATA_HUB: 'admin person index aggregates across inlets',
  QA_CLEANUP: 'test record purge scripts',
  AUTH_LOOKUP: 'login before tenant context exists',
  ATTENDANCE_REFRESH: 'cron attendance metrics without request tenant',
  FINANCE_ADMIN: 'finance admin rollup before tenant backfill',
};

function isRouteBypassAllowed(routeFile) {
  return ROUTE_ALLOWLIST.has(routeFile);
}

function isServiceBypassAllowed(serviceFile) {
  return SERVICE_ALLOWLIST.has(serviceFile);
}

function isControllerBypassAllowed(file) {
  return CONTROLLER_ALLOWLIST.has(file);
}

function isUtilBypassAllowed(file) {
  return UTIL_ALLOWLIST.has(file);
}

/** Scripts under server/scripts/ are maintenance — not runtime route handlers. */
function isScriptPath(filePath) {
  return /[/\\]scripts[/\\]/.test(filePath) || /[/\\]services[/\\]qa[/\\]/.test(filePath);
}

function bypassOptions(reason) {
  return { bypassTenant: true, _bypassReason: reason };
}

module.exports = {
  ROUTE_ALLOWLIST,
  SERVICE_ALLOWLIST,
  CONTROLLER_ALLOWLIST,
  UTIL_ALLOWLIST,
  USE_CASES,
  isRouteBypassAllowed,
  isServiceBypassAllowed,
  isControllerBypassAllowed,
  isUtilBypassAllowed,
  isScriptPath,
  bypassOptions,
};
