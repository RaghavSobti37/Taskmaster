const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const PAYMENT_STATUSES = ['pending', 'partial', 'paid'];

const ArtistGigSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  inquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ArtistInquiry' },
  name: { type: String, required: true },
  location: { type: String },
  gigDate: { type: Date, required: true, index: true },
  rate: { type: Number, default: 0 },
  expense: { type: Number, default: 0 },
  invoiceRef: { type: String },
  contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'ArtistContract' },
  paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

ArtistGigSchema.virtual('profit').get(function profit() {
  return (this.rate || 0) - (this.expense || 0);
});

ArtistGigSchema.set('toJSON', { virtuals: true });
ArtistGigSchema.set('toObject', { virtuals: true });
ArtistGigSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistGig', ArtistGigSchema);
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
