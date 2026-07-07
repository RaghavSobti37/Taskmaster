const mongoose = require('mongoose');
const { getTenantId } = require('../utils/tenantContext');
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
  schema.pre('validate', async function () {
    if (!this.tenantId) {
      const tenantId = getTenantId();
      if (tenantId) {
        this.tenantId = tenantId;
      } else if (
        process.env.NODE_ENV !== 'production'
        && (
          process.env.NODE_ENV === 'test'
          || String(process.env.ALLOW_DEFAULT_TENANT_FALLBACK || '').trim().toLowerCase() === 'true'
        )
      ) {
        const Tenant = require('../models/Tenant');
        const { allFeatureUnlocks } = require('../../shared/orgFeatures.cjs');
        let defaultTenant = await Tenant.findOne({ name: 'Default Tenant' }).setOptions({ bypassTenant: true });
        if (!defaultTenant) {
          defaultTenant = await Tenant.create({
            name: 'Default Tenant',
            contactEmail: 'helloworld@theshakticollective',
            status: 'active',
            featureUnlocks: allFeatureUnlocks(),
          });
        } else {
          const unlocks = allFeatureUnlocks();
          const current = defaultTenant.featureUnlocks?.toObject?.() || defaultTenant.featureUnlocks || {};
          const needsUnlockRepair = Object.entries(unlocks).some(([key, value]) => current[key] !== value);
          if (needsUnlockRepair) {
            defaultTenant.featureUnlocks = unlocks;
            defaultTenant.markModified('featureUnlocks');
            await defaultTenant.save();
          }
        }
        this.tenantId = defaultTenant._id;
      } else {
        throw new Error('tenantId required: missing tenant context');
      }
    }
  });

  // Helper to inject tenantId into query filter
  const injectTenantId = function () {
    // Check if query options explicitly bypass tenant scoping
    if (this.options && this.options.bypassTenant) {
      return;
    }

    const tenantId = (this.options && this.options.tenantId) || getTenantId();
    if (tenantId) {
      this.where(tenantIdFilter(tenantId));
    }
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
    'deleteOne',
    'distinct',
  ];

  queryMethods.forEach((method) => {
    schema.pre(method, injectTenantId);
  });

  // aggregate() bypasses query middleware — prepend tenant $match to pipeline
  schema.pre('aggregate', function injectTenantAggregate() {
    if (this.options && this.options.bypassTenant) {
      return;
    }

    const tenantId = (this.options && this.options.tenantId) || getTenantId();
    if (!tenantId) return;

    const pipeline = this.pipeline();
    const tenantMatch = { $match: tenantIdFilter(tenantId) };
    const first = pipeline[0];
    if (first && first.$match && first.$match.$or && tenantIdFilter(tenantId).$or) {
      pipeline[0] = {
        $match: { $and: [tenantIdFilter(tenantId), first.$match] },
      };
    } else {
      pipeline.unshift(tenantMatch);
    }
  });
};
