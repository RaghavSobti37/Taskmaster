const mongoose = require('mongoose');

module.exports = function tenantPlugin(schema, options) {
  // Add tenantId to the schema if it doesn't exist
  if (!schema.path('tenantId')) {
    schema.add({
      tenantId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Tenant', 
        required: false, // TEMPORARY: Set to false until migration is complete
        index: true 
      }
    });
  }

  // Helper to inject tenantId into query filter
  const injectTenantId = function (next) {
    // Determine tenantId from a global context or async local storage, 
    // but in Mongoose it's often passed via query options:
    // Model.find({}).setOptions({ tenantId: req.tenantId })
    const tenantId = this.options.tenantId;
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
