const mongoose = require('mongoose');

/**
 * Lead Schema for TSC CRM.
 * Optimized for MongoDB migration while maintaining compatibility with current CSV structure.
 */
const LeadSchema = new mongoose.Schema({
  // Core Identifiers
  rowId: { type: String, unique: true, sparse: true }, // Legacy identifier from CSV
  customerIdExly: { type: String, index: true },
  transactionIdExly: { type: String, index: true },
  
  // Basic Information
  name: { type: String, required: true },
  email: { type: String, index: true },
  phone: { type: String, required: true, index: true },
  
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
  planOption: { type: String }, // One-Time, 3 Mo, 6 Mo, 9 Mo
  
  // Followup Protocols
  nextFollowupDate: { type: String },
  nextFollowupTime: { type: String },
  
  // Internal Assignment & Metadata
  assignedRepId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // Ref to User model
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  importId: { type: mongoose.Schema.Types.ObjectId, ref: 'CRMImport' },
  
  // Flexible Metadata for future-proofing
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  
  // Concurrency Locking
  lockedBy: { type: String }, // User ID holding the lock
  lockedAt: { type: Date },
  reminderSent: { type: Boolean, default: false },
  notifiedOverdue: { type: Boolean, default: false }
}, { 
  timestamps: true // Automatically handles createdAt and updatedAt
});

// Index for full-text search across multiple fields
LeadSchema.index({ name: 'text', email: 'text', phone: 'text', remarks: 'text' });

module.exports = mongoose.model('Lead', LeadSchema);
