const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');


const crmImportSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  leadCount: { type: Number, required: true },
  crmType: { type: String, enum: ['sales', 'artist'], default: 'sales', index: true },
  sheetTemplate: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

crmImportSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CRMImport', crmImportSchema);
