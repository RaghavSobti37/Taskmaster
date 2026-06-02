const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String },
  date: { type: Date, required: true, index: true },
  inTimeRecord: {
    systemTimestamp: { type: Date },
    manualTimestamp: { type: String },
    workMode: { type: String, enum: ['office', 'wfh'], default: 'office' },
    isApproved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checkInIp: { type: String },
    verificationMethod: { type: String, enum: ['GPS', 'NETWORK', 'MANUAL', 'NONE'], default: 'NONE' }
  },
  outTimeRecord: {
    systemTimestamp: { type: Date },
    manualTimestamp: { type: String },
    workMode: { type: String, enum: ['office', 'wfh'], default: 'office' },
    isApproved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checkOutIp: { type: String },
    verificationMethod: { type: String, enum: ['GPS', 'NETWORK', 'MANUAL', 'NONE'], default: 'NONE' }
  },
  isHalfDay: { type: Boolean, default: false },
  onLeave: { type: Boolean, default: false },
  reason: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  overtimeMinutes: { type: Number, default: 0 },
  systemHours: { type: Number, default: 0 },
  loggedHours: { type: Number, default: 0 },
  discrepancyMinutes: { type: Number, default: 0 },
  /** Set when full-day attendance XP is granted after both IN/OUT are admin-approved. */
  xpGrantedAt: { type: Date },
}, { timestamps: true });

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
