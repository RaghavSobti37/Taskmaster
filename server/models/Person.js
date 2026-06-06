const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const PersonSchema = new mongoose.Schema({
  canonicalName: { type: String, required: true, index: true },
  nameKey: { type: String, index: true },
  city: { type: String },
  country: { type: String },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  identityVersion: { type: Number, default: 1 },
}, { timestamps: true });

PersonSchema.index({ canonicalName: 'text' });
PersonSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Person', PersonSchema);
