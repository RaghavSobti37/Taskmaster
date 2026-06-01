const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const calendarEventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  date: { type: Date, required: true },
  endDate: { type: Date, default: null },
  eventType: {
    type: String,
    enum: ['meeting', 'instagram_post', 'youtube_post', 'shoot_day', 'event', 'musical_day'],
    default: 'event',
  },
  visibility: { type: String, enum: ['public', 'private', 'project'], default: 'public' },
  workspace: { type: String, default: '' },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

calendarEventSchema.index({ date: 1 });
calendarEventSchema.index({ endDate: 1 });
calendarEventSchema.index({ createdBy: 1 });
calendarEventSchema.index({ visibility: 1 });
calendarEventSchema.index({ projectId: 1 });

calendarEventSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
