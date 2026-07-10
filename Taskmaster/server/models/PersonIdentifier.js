const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const PersonIdentifierSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true, index: true },
  type: { type: String, enum: ['email', 'phone'], required: true },
  valueNormalized: { type: String, required: true },
  source: { type: String, default: 'unknown' },
  verified: { type: Boolean, default: false },
}, { timestamps: true });

PersonIdentifierSchema.index({ tenantId: 1, type: 1, valueNormalized: 1 }, { unique: true });
PersonIdentifierSchema.index({ personId: 1, type: 1 });

PersonIdentifierSchema.plugin(tenantPlugin);

module.exports = mongoose.model('PersonIdentifier', PersonIdentifierSchema);
