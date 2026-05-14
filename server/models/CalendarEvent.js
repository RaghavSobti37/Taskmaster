const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  date: { type: Date, required: true },
  visibility: { type: String, enum: ['public', 'private'], default: 'private' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

calendarEventSchema.index({ date: 1 });
calendarEventSchema.index({ createdBy: 1 });
calendarEventSchema.index({ visibility: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
