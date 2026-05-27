const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');


const logSchema = new mongoose.Schema({
  // Unified Logging Fields
  timestamp: { type: Date, default: Date.now, index: true },
  origin: { type: String, enum: ['HUMAN_USER', 'SYSTEM_AUTOMATION', 'QA_AGENT_TEST'], required: true, index: true },
  actorId: { type: String, required: true, index: true }, // userId, 'SYSTEM', or testCaseId
  actorRole: { type: String }, // 'admin', 'sales', 'QA_ENGINEER'
  actionType: { type: String, required: true }, // 'BUTTON_CLICK', 'API_REQUEST', 'BACKGROUND_BACKUP', 'TEST_ASSERTION'
  targetEntity: { type: String }, // 'Lead', 'ExlyBooking', 'Project'
  status: { type: String, enum: ['SUCCESS', 'FAILED', 'WARN', 'BUG_DETECTED'], index: true },
  payload: { type: mongoose.Schema.Types.Mixed }, // Details of the log step, request body, or error stack
  executionTimeMs: { type: Number },

  // Backward Compatibility Fields
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  targetId: { type: mongoose.Schema.Types.ObjectId },
  targetType: { type: String },
  createdAt: { type: Date, default: Date.now, expires: '90d' } // Auto-purge after 90 days
});

// Middleware for backward compatibility (map old fields to new fields and vice versa)
logSchema.pre('validate', function (next) {
  if (this.userId) {
    if (!this.actorId) this.actorId = this.userId.toString();
    if (!this.origin) this.origin = 'HUMAN_USER';
  }
  if (this.action) {
    if (!this.actionType) this.actionType = this.action;
  }
  if (this.details) {
    if (!this.payload) this.payload = this.details;
  }
  if (this.targetType) {
    if (!this.targetEntity) this.targetEntity = this.targetType;
  }
  if (this.createdAt && !this.timestamp) {
    this.timestamp = this.createdAt;
  }
  
  // Forward mapping
  if (this.actorId && !this.userId && mongoose.isValidObjectId(this.actorId)) {
    this.userId = this.actorId;
  }
  if (this.actionType && !this.action) {
    this.action = this.actionType;
  }
  if (this.payload && !this.details) {
    this.details = this.payload;
  }
  if (this.targetEntity && !this.targetType) {
    this.targetType = this.targetEntity;
  }
  if (this.timestamp && !this.createdAt) {
    this.createdAt = this.timestamp;
  }
  
  // Default values
  if (!this.origin) {
    this.origin = 'SYSTEM_AUTOMATION';
  }
  if (!this.actorId) {
    this.actorId = 'SYSTEM';
  }
  if (!this.actionType) {
    this.actionType = 'SYSTEM_ACTION';
  }
  if (!this.status) {
    this.status = 'SUCCESS';
  }
  next();
});

logSchema.index({ origin: 1, status: 1, timestamp: -1 });
logSchema.index({ userId: 1, createdAt: -1 });
logSchema.index({ tenantId: 1, createdAt: -1 });

logSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Log', logSchema);

