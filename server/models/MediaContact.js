const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const MediaContactSchema = new mongoose.Schema({
  publication: { type: String, required: true, trim: true, index: true },
  journalistName: { type: String, default: '', trim: true, index: true },
  designation: { type: String, default: '', trim: true },
  contactEmail: { type: String, default: '', trim: true, lowercase: true, index: true },
  contactPhone: { type: String, default: '', trim: true },
  niche: { type: String, default: '', trim: true, index: true },
  location: { type: String, default: '', trim: true },
  notes: { type: String, default: '', trim: true },
  sourceSheet: { type: String, required: true, trim: true, index: true },
}, { timestamps: true });

MediaContactSchema.index(
  { tenantId: 1, sourceSheet: 1, publication: 1, journalistName: 1, contactEmail: 1 },
  { unique: true },
);
MediaContactSchema.index({
  publication: 'text',
  journalistName: 'text',
  niche: 'text',
  designation: 'text',
  location: 'text',
  notes: 'text',
});
MediaContactSchema.plugin(tenantPlugin);

module.exports = mongoose.model('MediaContact', MediaContactSchema);
