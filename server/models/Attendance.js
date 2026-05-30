const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String },
  date: { type: Date, required: true, index: true },
  timeIn: { type: String },
  timeOut: { type: String },
  isHalfDay: { type: Boolean, default: false },
  onLeave: { type: Boolean, default: false },
  reason: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  checkInIp: { type: String },
  workMode: { type: String, enum: ['office', 'wfh'], default: 'wfh' },
  workModeOverrideBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  overtimeMinutes: { type: Number, default: 0 },
  systemHours: { type: Number, default: 0 },
  loggedHours: { type: Number, default: 0 },
  discrepancyMinutes: { type: Number, default: 0 },
}, { timestamps: true });

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
