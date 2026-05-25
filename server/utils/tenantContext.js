const { AsyncLocalStorage } = require('async_hooks');
const tenantStorage = new AsyncLocalStorage();

module.exports = {
  tenantStorage,
  getTenantId: () => {
    const store = tenantStorage.getStore();
    return store ? store.tenantId : null;
  },
  getUserId: () => {
    const store = tenantStorage.getStore();
    return store ? store.userId : null;
  },
  runWithContext: (context, fn) => {
    return tenantStorage.run(context, fn);
  }
};
