const mongoose = require('mongoose');
const { getTenantId } = require('../utils/tenantContext');
const { isProduction } = require('../utils/workerTenantContext');
const { tenantIdFilter } = require('../utils/mongoId');

module.exports = function tenantPlugin(schema, options) {
  // Add tenantId to the schema if it doesn't exist
  if (!schema.path('tenantId')) {
    schema.add({
      tenantId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Tenant', 
        required: false, // Set to false to support fallback contexts, validated on save/validate
        index: true 
      }
    });
  }

  // Pre-validate hook to automatically populate tenantId from AsyncLocalStorage context on document creation
  schema.pre('validate', async function (next) {
    if (!this.tenantId) {
      const tenantId = getTenantId();
      if (tenantId) {
        this.tenantId = tenantId;
      } else if (isProduction()) {
        return next(new Error('tenantId required: missing tenant context in production'));
      } else {
        try {
          const Tenant = require('../models/Tenant');
          let defaultTenant = await Tenant.findOne({ name: 'Default Tenant' });
          if (!defaultTenant) {
            defaultTenant = await Tenant.create({
              name: 'Default Tenant',
              contactEmail: 'admin@theshakticollective.in',
            });
          }
          this.tenantId = defaultTenant._id;
        } catch (e) {
          return next(e);
        }
      }
    }
    next();
  });

  // Helper to inject tenantId into query filter
  const injectTenantId = function (next) {
    // Check if query options explicitly bypass tenant scoping
    if (this.options && this.options.bypassTenant) {
      return next();
    }

    const tenantId = (this.options && this.options.tenantId) || getTenantId();
    if (tenantId) {
      this.where(tenantIdFilter(tenantId));
    }
    next();
  };

  // Apply to all query methods
  const queryMethods = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndRemove',
    'findOneAndDelete',
    'update',
    'updateOne',
    'updateMany',
    'count',
    'countDocuments',
    'deleteMany',
    'deleteOne'
  ];

  queryMethods.forEach((method) => {
    schema.pre(method, injectTenantId);
  });
};
