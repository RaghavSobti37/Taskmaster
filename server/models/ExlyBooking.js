const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const { applyPersonIdentityToDoc } = require('../utils/personNormalization');


const ExlyBookingSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', index: true },
  name: { type: String, required: true },
  nameKey: { type: String, index: true },
  email: { type: String, index: true },
  phone: { type: String, required: true, index: true },
  offeringTitle: { type: String, required: true, index: true },
  offeringId: { type: String, required: true, index: true },
  pricePaid: { type: Number, default: 0 },
  bookedOn: { type: Date, required: true, index: true },
  paymentType: { type: String },
  debitType: { type: String },
  offeringType: { type: String },
  offeringOwner: { type: String },
  promotionType: { type: String },
  promotionFromOffering: { type: String },
  transactionId: { type: String, index: true },
  customerId: { type: String, index: true },
  state: { type: String },
  payoutStatus: { type: String },
  // Mailer specific fields
  emailStatus: { type: String, enum: ['Active', 'Unsubscribed', 'Invalid', 'Pending', 'Bounced'], default: 'Pending' },
  bounceCount: { type: Number, default: 0 },
  unsubscribed: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Compound index to prevent duplicate booking imports
ExlyBookingSchema.index({ email: 1, phone: 1, offeringId: 1, bookedOn: 1 }, { unique: true });
ExlyBookingSchema.index({ nameKey: 1 });

ExlyBookingSchema.pre('save', function(next) {
  try {
    applyPersonIdentityToDoc(this, { phoneRequired: true });
    next();
  } catch (err) {
    next(err);
  }
});

ExlyBookingSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ExlyBooking', ExlyBookingSchema);
