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
  isDefault: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

emailProfileSchema.plugin(tenantPlugin);

module.exports = mongoose.model('EmailProfile', emailProfileSchema);
