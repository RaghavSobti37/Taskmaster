const User = require('../models/User');
const { idFilter } = require('./mongoId');
const { getCache, setCache, deleteCache } = require('../services/cacheService');

const DEPARTMENT_POPULATE = 'name slug signupAllowed permissionPreset pagePermissions';
const BYPASS = { bypassTenant: true };
const AUTH_USER_CACHE_TTL_SECONDS = 45;

const findUserById = (userId, options = {}) => {
  const { withPassword = false, select } = options;
  let query = User.findOne(idFilter(userId)).setOptions(BYPASS);
  if (withPassword) query = query.select('+password');
  else if (select) query = query.select(select);
  else query = query.select('-password');
  return query;
};

const authUserCacheKey = (userId) => `auth:user:v1:${userId}`;

const loadAuthUser = async (userId) => {
  const cacheKey = authUserCacheKey(userId);
  const cached = await getCache(cacheKey);
  if (cached) {
    return User.hydrate(cached);
  }

  const user = await findUserById(userId).populate('departmentId', DEPARTMENT_POPULATE);
  if (user) {
    await setCache(cacheKey, user.toObject(), AUTH_USER_CACHE_TTL_SECONDS);
  }
  return user;
};

const invalidateAuthUserCache = (userId) => deleteCache(authUserCacheKey(userId));

module.exports = {
  findUserById,
  loadAuthUser,
  invalidateAuthUserCache,
  DEPARTMENT_POPULATE,
};
