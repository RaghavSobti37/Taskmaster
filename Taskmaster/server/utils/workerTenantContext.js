const { runWithContext, getTenantId } = require('./tenantContext');

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Run a worker/cron callback with explicit tenant AsyncLocalStorage context.
 */
const runWithWorkerTenant = (tenantId, fn) =>
  runWithContext(
    {
      tenantId,
      userId: null,
      traceId: `worker-${Date.now()}`,
    },
    fn,
  );

/** All tenant ids — for per-tenant worker iteration before second org goes live. */
const getAllTenantIds = async () => {
  const Tenant = require('../models/Tenant');
  const tenants = await Tenant.find({}).select('_id').lean();
  return tenants.map((t) => t._id);
};

const runForEachTenant = async (fn) => {
  const ids = await getAllTenantIds();
  for (const tenantId of ids) {
    await runWithWorkerTenant(tenantId, () => fn(tenantId));
  }
};

module.exports = {
  getTenantId,
  runWithWorkerTenant,
  runForEachTenant,
  getAllTenantIds,
  isProduction,
};
