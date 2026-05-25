const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');


const crmImportSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  leadCount: { type: Number, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

crmImportSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CRMImport', crmImportSchema);
