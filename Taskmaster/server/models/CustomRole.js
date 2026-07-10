const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const customRoleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  pageKeys: [{ type: String }],
  resourceScopes: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

customRoleSchema.index({ tenantId: 1, name: 1 }, { unique: true });

customRoleSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CustomRole', customRoleSchema);
