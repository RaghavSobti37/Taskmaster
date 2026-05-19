const mongoose = require('mongoose');
const { sanitizeName } = require('../utils/sanitizer');

const ExlyOfferingSchema = new mongoose.Schema({
  offeringId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  eventDate: { type: String, default: '' },
  eventTime: { type: String, default: '' },
  type: { type: String, default: 'program' },
  price: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['active', 'paused', 'draft'], default: 'active' },
  
  // Dynamic aggregations
  totalBookings: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  conversionRate: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Sanitization hook
ExlyOfferingSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.title = sanitizeName(this.title);
  }
  next();
});

module.exports = mongoose.model('ExlyOffering', ExlyOfferingSchema);
