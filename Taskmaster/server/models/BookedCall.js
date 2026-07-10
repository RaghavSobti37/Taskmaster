const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const { personFields, applyPersonPreSave } = require('./personFields');

const BookedCallSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', index: true },
  ...personFields,
  bookedAt: { type: Date, index: true },
  source: { type: String, index: true },
  callStatus: { type: String },
  importId: { type: mongoose.Schema.Types.ObjectId, ref: 'CRMImport' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

BookedCallSchema.index({ phone: 1, email: 1, bookedAt: 1 }, { unique: true, sparse: true });
applyPersonPreSave(BookedCallSchema);
BookedCallSchema.plugin(tenantPlugin);

module.exports = mongoose.model('BookedCall', BookedCallSchema);
