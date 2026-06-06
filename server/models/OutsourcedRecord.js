const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const { personFields, applyPersonPreSave } = require('./personFields');

const OutsourcedRecordSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', index: true },
  ...personFields,
  state: { type: String },
  role: { type: String },
  campaign: { type: String, index: true },
  originSource: { type: String, index: true },
  destination: { type: String },
  dataType: { type: String },
  sourceFilename: { type: String },
  importId: { type: mongoose.Schema.Types.ObjectId, ref: 'CRMImport' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  tags: [{ type: String, index: true }],
}, { timestamps: true });

OutsourcedRecordSchema.index({ phone: 1, email: 1 }, { unique: true });
applyPersonPreSave(OutsourcedRecordSchema);
OutsourcedRecordSchema.plugin(tenantPlugin);

module.exports = mongoose.model('OutsourcedRecord', OutsourcedRecordSchema);
