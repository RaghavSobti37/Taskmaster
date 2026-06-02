const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const {
  sanitizeEmail,
  sanitizeLocation,
  normalizePersonName,
  repairPhone,
  isCorruptLeadPhone,
} = require('../utils/sanitizer');
const { validatePhoneE164 } = require('../utils/phoneCountryValidation');

const TscDataSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameKey: { type: String, index: true },
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

const normalizeTscPhone = (phone) => {
  if (!phone) return '';
  let raw = phone;
  if (isCorruptLeadPhone(raw)) {
    const repaired = repairPhone(raw);
    if (repaired) raw = repaired;
  }
  const check = validatePhoneE164(raw);
  return check.valid ? check.phone : repairPhone(raw) || raw;
};

const applyTscIdentityFields = (set) => {
  if (!set) return;
  if (set.name && typeof set.name === 'string') {
    const { name, nameKey } = normalizePersonName(set.name);
    set.name = name;
    set.nameKey = nameKey;
  }
  if (set.email && typeof set.email === 'string') set.email = sanitizeEmail(set.email);
  if (set.phone && typeof set.phone === 'string') set.phone = normalizeTscPhone(set.phone);
  if (set.city && typeof set.city === 'string') set.city = sanitizeLocation(set.city);
  if (set.state && typeof set.state === 'string') set.state = sanitizeLocation(set.state);
};

TscDataSchema.pre('save', function(next) {
  if (this.isModified('name') || this.name) {
    const { name, nameKey } = normalizePersonName(this.name);
    this.name = name || this.name;
    this.nameKey = nameKey;
  }
  if (this.isModified('email') && this.email) this.email = sanitizeEmail(this.email);
  if (this.isModified('phone') && this.phone) this.phone = normalizeTscPhone(this.phone);
  if (this.isModified('city') && this.city) this.city = sanitizeLocation(this.city);
  if (this.isModified('state') && this.state) this.state = sanitizeLocation(this.state);
  next();
});

const sanitizeUpdate = (update) => {
  if (!update) return;
  const set = update.$set || update;
  applyTscIdentityFields(set);
};

TscDataSchema.pre('findOneAndUpdate', function(next) {
  sanitizeUpdate(this.getUpdate());
  next();
});

TscDataSchema.pre('updateOne', function(next) {
  sanitizeUpdate(this.getUpdate());
  next();
});

TscDataSchema.pre('updateMany', function(next) {
  sanitizeUpdate(this.getUpdate());
  next();
});

// Uniqueness Constraints
TscDataSchema.index({ phone: 1, email: 1 }, { unique: true });

// Indexes
TscDataSchema.index({ name: 'text', email: 'text', phone: 'text' });
TscDataSchema.index({ createdAt: -1 });

TscDataSchema.plugin(tenantPlugin);

module.exports = mongoose.model('TscData', TscDataSchema);
