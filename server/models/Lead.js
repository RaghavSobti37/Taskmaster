const mongoose = require('mongoose');
const { sanitizeName, sanitizeEmail, normalizePhone, validateDate, sanitizeLocation } = require('../utils/sanitizer');
const auditPlugin = require('./plugins/auditPlugin');

/**
 * Lead Schema for TSC CRM.
 * Optimized for MongoDB migration while maintaining compatibility with current CSV structure.
 */
const LeadSchema = new mongoose.Schema({
  // Core Identifiers
  rowId: { type: String, unique: true, sparse: true }, // Legacy identifier from CSV
  customerIdExly: { type: String, index: true },
  transactionIdExly: { type: String, index: true },
  exlyOfferingId: { type: String, index: true },
  exlyOfferingTitle: { type: String, index: true },
  
  // Basic Information
  name: { type: String, required: true },
  email: { type: String, index: true },
  phone: { type: String, required: true, index: true },
  city: { type: String, index: true },
  
  // Webinar & Engagement (Source Data)
  webinarDates: { type: String },
  attended: { type: String }, // 'Y', 'N', or ''
  attendanceDurationMin: { type: String },
  qnaAnswered: { type: String },
  
  // Artist Profile (Discovery Data)
  artistType: { type: String }, // Full Time, Part Time, Hobbyist
  fullTimeWillingness: { type: String }, // Yes, No, Maybe
  primaryRole: { type: String },
  learningGoal: { type: String },
  learnedMusic: { type: String },
  currentJourney: { type: String },
  
  // CRM Funnel & Sales Status
  meaningfulConnect: { type: String, default: 'PENDING' }, // YES, NO, PENDING
  leadQuality: { type: String, default: '1' }, // 1-5, Future 4
  callStatus: { type: String, default: 'Pending' }, // Connected, Busy, DNP, etc.
  leadStatus: { type: String, default: 'New' }, // Cold, Warm, Hot, Converted, etc.
  remarks: { type: String },
  notes: [{
    text: { type: String, required: true },
    author: { type: String, required: true },
    date: { type: Date, default: Date.now }
  }],
  source: { type: String, default: 'Organic / Direct', index: true },
  planOption: { type: String }, // One-Time, 3 Mo, 6 Mo, 9 Mo
  
  // Followup Protocols
  nextFollowupDate: { type: String },
  nextFollowupTime: { type: String },
  setReminder: { type: Boolean, default: false },
  
  // Internal Assignment & Metadata
  assignedRepId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // Ref to User model
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  importId: { type: mongoose.Schema.Types.ObjectId, ref: 'CRMImport' },
  
  // Flexible Metadata for future-proofing
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  tags: [{ type: String, index: true }],
  emailStatus: { type: String, enum: ['Active', 'Unsubscribed', 'Invalid', 'Pending', 'Bounced'], default: 'Pending', index: true },
  status: { type: String, enum: ['active', 'inactive', 'engaged'], default: 'active' },
  location: { type: String },
  bounceCount: { type: Number, default: 0, index: true },
  unsubscribed: { type: Boolean, default: false, index: true },
  unsubscribeReason: { type: String },
  
  // Concurrency Locking
  lockedBy: { type: String }, // User ID holding the lock
  lockedAt: { type: Date },
  reminderSent: { type: Boolean, default: false },
  notifiedOverdue: { type: Boolean, default: false }
}, { 
  timestamps: true // Automatically handles createdAt and updatedAt
});

// Sanitization Hook
LeadSchema.pre('save', function(next) {
  if (this.isModified('name')) this.name = sanitizeName(this.name);
  if (this.isModified('email')) this.email = sanitizeEmail(this.email);
  if (this.isModified('phone')) this.phone = normalizePhone(this.phone);
  if (this.isModified('city') && this.city) this.city = sanitizeLocation(this.city);
  if (this.isModified('location') && this.location) this.location = sanitizeLocation(this.location);
  
  // Date validation for followups
  if (this.isModified('nextFollowupDate') && this.nextFollowupDate) {
    if (!validateDate(this.nextFollowupDate)) {
      this.nextFollowupDate = ''; // Reset or fallback
    }
  }
  next();
});

const sanitizeUpdate = (update) => {
  if (!update) return;
  const set = update.$set || update;
  if (set.name && typeof set.name === 'string') set.name = sanitizeName(set.name);
  if (set.email && typeof set.email === 'string') set.email = sanitizeEmail(set.email);
  if (set.phone && typeof set.phone === 'string') set.phone = normalizePhone(set.phone);
  if (set.city && typeof set.city === 'string') set.city = sanitizeLocation(set.city);
  if (set.location && typeof set.location === 'string') set.location = sanitizeLocation(set.location);
};

LeadSchema.pre('findOneAndUpdate', function(next) {
  sanitizeUpdate(this.getUpdate());
  next();
});

LeadSchema.pre('updateOne', function(next) {
  sanitizeUpdate(this.getUpdate());
  next();
});

LeadSchema.pre('updateMany', function(next) {
  sanitizeUpdate(this.getUpdate());
  next();
});

// Apply Audit Plugin
LeadSchema.plugin(auditPlugin);

// Background Queue & Followup Cache Integration
const backgroundQueue = require('../services/backgroundQueue');
const followupCache = require('../services/followupCache');

LeadSchema.post('save', function(doc) {
  if (doc) {
    backgroundQueue.queueHolySheetSync(doc._id);
    backgroundQueue.queueCsvBackup();
    followupCache.cacheFollowup(doc).catch(() => {});
  }
});

LeadSchema.post('findOneAndUpdate', function(doc) {
  if (doc) {
    backgroundQueue.queueHolySheetSync(doc._id);
    backgroundQueue.queueCsvBackup();
    followupCache.cacheFollowup(doc).catch(() => {});
  }
});

LeadSchema.post('updateOne', async function() {
  try {
    const doc = await this.model.findOne(this.getQuery());
    if (doc) {
      backgroundQueue.queueHolySheetSync(doc._id);
      backgroundQueue.queueCsvBackup();
      followupCache.cacheFollowup(doc).catch(() => {});
    }
  } catch (err) {
    console.error('[Queue Hook Error]', err.message);
  }
});

LeadSchema.post('updateMany', async function() {
  try {
    const docs = await this.model.find(this.getQuery());
    for (const doc of docs) {
      backgroundQueue.queueHolySheetSync(doc._id);
      followupCache.cacheFollowup(doc).catch(() => {});
    }
    if (docs.length > 0) {
      backgroundQueue.queueCsvBackup();
    }
  } catch (err) {
    console.error('[Queue Hook Error]', err.message);
  }
});

LeadSchema.post('remove', function(doc) {
  if (doc) {
    followupCache.removeFollowup(doc._id).catch(() => {});
  }
});

LeadSchema.post('deleteOne', { document: true, query: false }, function(doc) {
  if (doc) {
    followupCache.removeFollowup(doc._id).catch(() => {});
  }
});

// Core Uniqueness Constraints
LeadSchema.index({ phone: 1 }, { unique: true });
LeadSchema.index({ email: 1 }, { unique: true, sparse: true }); // Sparse because email might be empty
LeadSchema.index({ email: 1, unsubscribed: 1, bounceCount: 1 });

// Indexes for common query patterns
LeadSchema.index({ assignedRepId: 1, nextFollowupDate: 1, nextFollowupTime: 1 });
LeadSchema.index({ assignedRepId: 1, leadStatus: 1 });
LeadSchema.index({ createdAt: -1 });

// Index for full-text search across multiple fields
LeadSchema.index({ name: 'text', email: 'text', phone: 'text', remarks: 'text' });

module.exports = mongoose.model('Lead', LeadSchema);
