const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const EVENT_TYPES = ['inquiry', 'gig', 'dead', 'personal', 'release'];

const ArtistCalendarEventSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  eventType: { type: String, enum: EVENT_TYPES, default: 'personal' },
  title: { type: String, required: true },
  startAt: { type: Date, required: true, index: true },
  endAt: { type: Date },
  status: { type: String },
  value: { type: Number },
  sourceType: { type: String },
  sourceId: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

ArtistCalendarEventSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistCalendarEvent', ArtistCalendarEventSchema);
module.exports.EVENT_TYPES = EVENT_TYPES;
