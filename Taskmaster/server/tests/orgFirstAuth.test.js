jest.mock('../utils/clerkAuth', () => ({
  isClerkConfigured: jest.fn(() => false),
}));

const User = require('../models/User');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const { isOrgFirstAuthEnabled } = require('../utils/orgFirstAuth');
const { applySessionTenant, protect } = require('../middleware/authMiddleware');
const { COOKIE_NAME } = require('../utils/authCookie');
const { getAuthConfig } = require('../domains/auth/controllers/authController');
const { finishAuthSession } = require('../utils/sessionRegistry');
const { mockAuthReq, mockAuthRes } = require('./helpers/mintTestSession');

describe('orgFirstAuth', () => {
  const prevFlag = process.env.CLERK_ORG_FIRST_AUTH;

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.CLERK_ORG_FIRST_AUTH;
    else process.env.CLERK_ORG_FIRST_AUTH = prevFlag;
  });

  it('isOrgFirstAuthEnabled respects env flag', () => {
    process.env.CLERK_ORG_FIRST_AUTH = 'true';
    expect(isOrgFirstAuthEnabled()).toBe(true);
    process.env.CLERK_ORG_FIRST_AUTH = 'false';
    expect(isOrgFirstAuthEnabled()).toBe(false);
  });

  it('getAuthConfig exposes orgFirstAuth', () => {
    process.env.CLERK_ORG_FIRST_AUTH = 'true';
    const res = {
      json: jest.fn(),
    };
    getAuthConfig({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ orgFirstAuth: true }));
  });

  describe('applySessionTenant', () => {
    let user;
    let tenantA;
    let tenantB;

    beforeEach(async () => {
      user = await User.create({
        name: 'Org First User',
        email: `org-first-${Date.now()}@example.com`,
      });
      tenantA = await Tenant.create({
        name: 'Tenant A',
        slug: `tenant-a-${Date.now().toString(36)}`,
        contactEmail: user.email,
        ownerId: user._id,
      });
      tenantB = await Tenant.create({
        name: 'Tenant B',
        slug: `tenant-b-${Date.now().toString(36)}`,
        contactEmail: user.email,
        ownerId: user._id,
      });
      await TenantMembership.create({
        userId: user._id,
        tenantId: tenantA._id,
        role: 'member',
        status: 'active',
      });
      await TenantMembership.create({
        userId: user._id,
        tenantId: tenantB._id,
        role: 'member',
        status: 'active',
      });
    });

    it('legacy mode auto-picks when JWT has activeTenantId', async () => {
      process.env.CLERK_ORG_FIRST_AUTH = 'false';
      const decoded = { activeTenantId: String(tenantA._id) };
      const session = await applySessionTenant({}, user, decoded);
      expect(session.needsTenantSelection).toBe(false);
      expect(String(session.tenantId)).toBe(String(tenantA._id));
    });

    it('legacy mode returns needsTenantSelection for multi-membership without JWT tenant', async () => {
      process.env.CLERK_ORG_FIRST_AUTH = 'false';
      const session = await applySessionTenant({}, user, { id: String(user._id) });
      expect(session.needsTenantSelection).toBe(true);
      expect(session.tenantId).toBeNull();
    });

    it('org-first mode requires JWT activeTenantId even with memberships', async () => {
      process.env.CLERK_ORG_FIRST_AUTH = 'true';
      const session = await applySessionTenant({}, user, { id: String(user._id) });
      expect(session.needsTenantSelection).toBe(true);
      expect(session.tenantId).toBeNull();
    });

    it('org-first mode uses JWT activeTenantId when present', async () => {
      process.env.CLERK_ORG_FIRST_AUTH = 'true';
      const decoded = { activeTenantId: String(tenantB._id) };
      const session = await applySessionTenant({}, user, decoded);
      expect(session.needsTenantSelection).toBe(false);
      expect(String(session.tenantId)).toBe(String(tenantB._id));
    });
    it('legacy mode auto-picks single membership without JWT tenant', async () => {
      process.env.CLERK_ORG_FIRST_AUTH = 'false';
      const soloUser = await User.create({
        name: 'Solo Member',
        email: `solo-${Date.now()}@example.com`,
      });
      await User.updateOne({ _id: soloUser._id }, { $unset: { tenantId: 1 } });
      const refreshedSolo = await User.findById(soloUser._id).setOptions({ bypassTenant: true });
      const soloTenant = await Tenant.create({
        name: 'Solo Tenant',
        slug: `solo-${Date.now().toString(36)}`,
        contactEmail: refreshedSolo.email,
        ownerId: refreshedSolo._id,
      });
      await TenantMembership.create({
        userId: refreshedSolo._id,
        tenantId: soloTenant._id,
        role: 'member',
        status: 'active',
      });
      const session = await applySessionTenant({}, refreshedSolo, { id: String(refreshedSolo._id) });
      expect(session.needsTenantSelection).toBe(false);
      expect(String(session.tenantId)).toBe(String(soloTenant._id));
    });
  });

  describe('protect middleware', () => {
    let user;
    let tenant;

    beforeEach(async () => {
      user = await User.create({
        name: 'Protect User',
        email: `protect-${Date.now()}@example.com`,
      });
      tenant = await Tenant.create({
        name: 'Protect Tenant',
        slug: `protect-${Date.now().toString(36)}`,
        contactEmail: user.email,
        ownerId: user._id,
      });
      await TenantMembership.create({
        userId: user._id,
        tenantId: tenant._id,
        role: 'member',
        status: 'active',
      });
    });

    const makeRes = () => {
      const res = {};
      res.status = jest.fn(() => res);
      res.json = jest.fn(() => res);
      return res;
    };

    const mintCookie = async (userId, activeTenantId = null) => {
      const req = mockAuthReq();
      const res = mockAuthRes();
      await finishAuthSession(req, res, userId, activeTenantId);
      return res.getCookie(COOKIE_NAME);
    };

    it('org-first returns 409 when session lacks activeTenantId', async () => {
      process.env.CLERK_ORG_FIRST_AUTH = 'true';
      const token = await mintCookie(user._id, null);
      const req = {
        cookies: { [COOKIE_NAME]: token },
        headers: {},
        ip: '127.0.0.1',
        originalUrl: '/api/projects',
        url: '/api/projects',
        get: () => undefined,
      };
      const res = makeRes();
      const next = jest.fn();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'NEEDS_TENANT_SELECTION',
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('org-first allows protected route when JWT has activeTenantId', async () => {
      process.env.CLERK_ORG_FIRST_AUTH = 'true';
      const token = await mintCookie(user._id, String(tenant._id));
      const req = {
        cookies: { [COOKIE_NAME]: token },
        headers: {},
        ip: '127.0.0.1',
        originalUrl: '/api/projects',
        url: '/api/projects',
        get: () => undefined,
      };
      const res = makeRes();
      const next = jest.fn();

      await protect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(String(req.tenantId)).toBe(String(tenant._id));
    });
  });
});
