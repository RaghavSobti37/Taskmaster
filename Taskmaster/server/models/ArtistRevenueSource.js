const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const REVENUE_TYPES = ['gig', 'royalty', 'brand'];

const ArtistRevenueSourceSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  type: { type: String, enum: REVENUE_TYPES, required: true, index: true },
  label: { type: String, required: true },
  amount: { type: Number, default: 0 },
  period: { type: String },
}, { timestamps: true });

ArtistRevenueSourceSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistRevenueSource', ArtistRevenueSourceSchema);
module.exports.REVENUE_TYPES = REVENUE_TYPES;
