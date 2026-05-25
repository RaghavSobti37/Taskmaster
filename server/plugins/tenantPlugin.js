const mongoose = require('mongoose');
const { getTenantId } = require('../utils/tenantContext');

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
      } else {
        try {
          const Tenant = require('../models/Tenant');
          let defaultTenant = await Tenant.findOne({ name: 'Default Tenant' });
          if (!defaultTenant) {
            defaultTenant = await Tenant.create({
              name: 'Default Tenant',
              contactEmail: 'admin@theshakticollective.in'
            });
          }
          this.tenantId = defaultTenant._id;
        } catch (e) {
          // Fallback if Tenant model fails to load or create
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
      this.where({ tenantId });
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
