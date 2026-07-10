const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const PersonSourceLinkSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true, index: true },
  sourceType: {
    type: String,
    enum: ['lead', 'exly_booking', 'outsourced', 'booked_call', 'newsletter', 'artist_path', 'mail', 'enquiry'],
    required: true,
    index: true,
  },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

PersonSourceLinkSchema.index({ personId: 1, sourceType: 1, sourceId: 1 }, { unique: true });
PersonSourceLinkSchema.index({ sourceType: 1, lastSeenAt: -1 });

PersonSourceLinkSchema.plugin(tenantPlugin);

module.exports = mongoose.model('PersonSourceLink', PersonSourceLinkSchema);
