const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const STATUS = ['active', 'expired', 'pending_reauth'];

const ArtistConnectionSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  provider: {
    type: String,
    required: true,
    enum: ['spotify', 'youtube', 'instagram', 'facebook', 'tiktok', 'twitch', 'meta'],
    index: true,
  },
  accountHandle: { type: String, default: '' },
  accountLabel: { type: String, default: '' },
  status: { type: String, enum: STATUS, default: 'active', index: true },
  isPrimary: { type: Boolean, default: true },
  tokenData: { type: String, select: false },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  lastSyncedAt: { type: Date },
  lastError: { type: String },
}, { timestamps: true });

ArtistConnectionSchema.index({ tenantId: 1, artistId: 1, provider: 1, accountHandle: 1 }, { unique: true });
ArtistConnectionSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistConnection', ArtistConnectionSchema);
