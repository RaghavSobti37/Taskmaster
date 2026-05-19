const mongoose = require('mongoose');

const ExlyBookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
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
  payoutStatus: { type: String }
}, {
  timestamps: true
});

// Compound index to prevent duplicate booking imports
ExlyBookingSchema.index({ email: 1, phone: 1, offeringId: 1, bookedOn: 1 }, { unique: true });

module.exports = mongoose.model('ExlyBooking', ExlyBookingSchema);
