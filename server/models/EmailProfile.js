const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');


const emailProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  smtpHost: { type: String, required: true },
  smtpPort: { type: Number, default: 587 },
  smtpUser: { type: String, required: true },
  smtpPass: { type: String, required: true },
  signature: { type: String, default: '' },
  providerType: {
    type: String,
    enum: ['gmail', 'outlook', 'yahoo', 'zoho', 'brevo', 'sendgrid', 'resend', 'custom'],
    default: 'custom'
  },
  dailyLimit: { type: Number, default: 500 },
  sendStats: {
    today: { type: Number, default: 0 },
    lastResetDate: { type: String, default: '' },
    total: { type: Number, default: 0 }
  },
  isDefault: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

emailProfileSchema.plugin(tenantPlugin);

module.exports = mongoose.model('EmailProfile', emailProfileSchema);
