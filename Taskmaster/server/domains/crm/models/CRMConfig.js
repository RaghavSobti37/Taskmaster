const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');


/**
 * Mongoose schema for dynamic CRM Configurations.
 * Abstracted to eliminate hardcoded fallbacks in controllers.
 */
const CRMConfigSchema = new mongoose.Schema({
  configKey: { type: String, required: true, default: 'default' },
  callStatuses: [{ type: String }],
  leadStatuses: [{ type: String }],
  artistTypes: [{ type: String }],
  meaningfulConnectStatuses: [{ type: String }],
  qualities: [{ type: String }],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

CRMConfigSchema.index({ tenantId: 1, configKey: 1 }, { unique: true });
CRMConfigSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CRMConfig', CRMConfigSchema);
