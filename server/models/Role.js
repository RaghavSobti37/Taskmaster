const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true }, // e.g., 'Sales Manager'
  permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }]
});

// A role name should be unique within a tenant
roleSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Role', roleSchema);
