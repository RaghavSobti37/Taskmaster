const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');


const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, index: true },
  phone: { type: String, index: true },
  
  // Data Aggregation Flags
  inCRM: { type: Boolean, default: false },
  inExly: { type: Boolean, default: false },
  inMailer: { type: Boolean, default: false },

  // Unified Data Points
  leadStatus: { type: String },
  leadQuality: { type: String },
  exlyOfferings: [{ type: String }],
  
  // Mailer specific tracking
  emailStatus: { type: String, enum: ['Active', 'Unsubscribed', 'Invalid', 'Pending', 'Bounced'], default: 'Pending' },
  bounceCount: { type: Number, default: 0 },
  unsubscribed: { type: Boolean, default: false },
  unsubscribeReason: { type: String },

  role: { type: String, default: 'Customer' },
  notes: { type: String },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Ensure unique combination (if email exists, index. If not, just phone).
// We rely on service layer logic to merge duplicates rather than strict DB constraints here to avoid null collision.
contactSchema.index({ phone: 1 });
contactSchema.index({ email: 1 });

contactSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Contact', contactSchema);
