const { AsyncLocalStorage } = require('async_hooks');
const { resolveDefaultTenantId } = require('./defaultTenant');
const tenantStorage = new AsyncLocalStorage();

const getTenantId = () => {
  const store = tenantStorage.getStore();
  return store ? store.tenantId : null;
};

const getUserId = () => {
  const store = tenantStorage.getStore();
  return store ? store.userId : null;
};

const getTraceId = () => {
  const store = tenantStorage.getStore();
  return store ? store.traceId : null;
};

const runWithContext = (context, fn) => tenantStorage.run(context, fn);

/** Tenant for writes when AsyncLocalStorage was lost across async middleware hops. */
const resolveTenantIdForRequest = async (req) => {
  const direct = getTenantId() || req?.tenantId || req?.user?.tenantId;
  if (direct) return direct;
  return resolveDefaultTenantId();
};

module.exports = {
  tenantStorage,
  getTenantId,
  getUserId,
  getTraceId,
  runWithContext,
  resolveTenantIdForRequest,
};
