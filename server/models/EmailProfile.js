const mongoose = require('mongoose');

const emailProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  smtpHost: { type: String, required: true },
  smtpPort: { type: Number, default: 587 },
  smtpUser: { type: String, required: true },
  smtpPass: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('EmailProfile', emailProfileSchema);
