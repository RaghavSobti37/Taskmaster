const {
  ROUTE_ALLOWLIST,
  SERVICE_ALLOWLIST,
  CONTROLLER_ALLOWLIST,
  isRouteBypassAllowed,
  isServiceBypassAllowed,
  isControllerBypassAllowed,
  isScriptPath,
  bypassOptions,
} = require('../infrastructure/database/bypassTenantPolicy');

describe('bypassTenantPolicy', () => {
  it('allows known public route files', () => {
    expect(isRouteBypassAllowed('track.js')).toBe(true);
    expect(ROUTE_ALLOWLIST.has('calendarRoutes.js')).toBe(false);
    expect(isRouteBypassAllowed('notificationRoutes.js')).toBe(false);
  });

  it('allows documented service-layer bypass', () => {
    expect(isServiceBypassAllowed('DataHubService.js')).toBe(true);
    expect(isServiceBypassAllowed('leadWriteService.js')).toBe(true);
    expect(isServiceBypassAllowed('scimProvisioningService.js')).toBe(true);
    expect(SERVICE_ALLOWLIST.size).toBeGreaterThanOrEqual(5);
  });

  it('rejects bypass in org/enterprise route files (service layer only)', () => {
    expect(isRouteBypassAllowed('tenantRoutes.js')).toBe(false);
    expect(isRouteBypassAllowed('enterpriseRoutes.js')).toBe(false);
    expect(isRouteBypassAllowed('scimRoutes.js')).toBe(false);
  });

  it('allows auth controllers before tenant context', () => {
    expect(isControllerBypassAllowed('authController.js')).toBe(true);
    expect(CONTROLLER_ALLOWLIST.has('authMiddleware.js')).toBe(true);
  });

  it('tags bypass options with reason', () => {
    expect(bypassOptions('test')).toEqual({ bypassTenant: true, _bypassReason: 'test' });
  });

  it('treats scripts and qa paths as maintenance', () => {
    expect(isScriptPath('server/scripts/seedE2eUsers.js')).toBe(true);
    expect(isScriptPath('server/services/qa/qaSnapshot.js')).toBe(true);
    expect(isScriptPath('server/routes/track.js')).toBe(false);
  });
});
