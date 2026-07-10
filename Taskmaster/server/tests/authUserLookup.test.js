const User = require('../models/User');
const Department = require('../models/Department');
const { setCache } = require('../services/cacheService');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const {
  loadAuthUser,
  invalidateAuthUserCache,
  authUserCacheKey,
} = require('../utils/authUserLookup');
const { hasCrmPageAccess, isAdminUser } = require('../utils/pagePermissions');
const { PRESET_PAGES } = require('../utils/pagePermissions');

describe('loadAuthUser cache + permissions', () => {
  let userId;

  beforeEach(async () => {
    if (userId) await invalidateAuthUserCache(userId);
  });

  beforeAll(async () => {
    let dept = await Department.findOne({ slug: 'admin' });
    if (!dept) {
      dept = await Department.create({
        name: 'Admin',
        slug: 'admin',
        permissionPreset: 'admin',
        pagePermissions: PRESET_PAGES.admin,
      });
    }
    const email = `auth-cache-test-${Date.now()}@coreknot-test.local`;
    const user = await User.create({
      name: 'Cache Test Admin',
      email,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
      departmentId: dept._id,
    });
    userId = user._id.toString();
  });

  it('cached hydrate repopulates department so CRM access works for admin', async () => {
    const fresh = await User.findById(userId).populate(
      'departmentId',
      'name slug signupAllowed permissionPreset pagePermissions',
    );
    expect(isAdminUser(fresh)).toBe(true);
    expect(hasCrmPageAccess(fresh)).toBe(true);

    const plain = fresh.toObject();
    if (plain.departmentId?._id) plain.departmentId = plain.departmentId._id;
    await setCache(authUserCacheKey(userId), plain, 60);

    const fromCache = await loadAuthUser(userId);
    expect(fromCache.departmentId?.slug).toBe('admin');
    expect(isAdminUser(fromCache)).toBe(true);
    expect(hasCrmPageAccess(fromCache)).toBe(true);
  });
});
