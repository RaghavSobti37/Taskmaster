const mongoose = require('mongoose');
const { sanitizeName, sanitizeEmail, normalizePhone, sanitizeLocation } = require('../utils/sanitizer');

const TscDataSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, index: true },
  phone: { type: String, index: true },
  city: { type: String },
  state: { type: String },
  role: { type: String },
  mediaUrl: { type: String },
  timestamp: { type: String },
  originSource: { type: String },
  destination: { type: String },
  campaign: { type: String, index: true },
  dataType: { type: String },
  dateCreatedFile: { type: String },
  dateModifiedFile: { type: String },
  sourceFilename: { type: String },
  
  // Metadata for the import
  importId: { type: mongoose.Schema.Types.ObjectId, ref: 'CRMImport' },
  
  // Custom metadata
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  tags: [{ type: String, index: true }],
  emailStatus: { type: String, enum: ['Active', 'Unsubscribed', 'Invalid', 'Pending', 'Bounced'], default: 'Pending', index: true }
}, {
  timestamps: true
});

// Sanitization Hook
TscDataSchema.pre('save', function(next) {
  if (this.isModified('name')) this.name = sanitizeName(this.name);
  if (this.isModified('email')) this.email = sanitizeEmail(this.email);
  if (this.isModified('phone')) this.phone = normalizePhone(this.phone);
  if (this.isModified('city') && this.city) this.city = sanitizeLocation(this.city);
  if (this.isModified('state') && this.state) this.state = sanitizeLocation(this.state);
  next();
});

// Uniqueness Constraints
TscDataSchema.index({ phone: 1, email: 1 }, { unique: true });

// Indexes
TscDataSchema.index({ name: 'text', email: 'text', phone: 'text' });
TscDataSchema.index({ createdAt: -1 });

module.exports = mongoose.model('TscData', TscDataSchema);
