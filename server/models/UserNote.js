const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const userNoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  calendarEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'CalendarEvent', default: null },
  workspace: { type: String, default: '' },
  title: { type: String, default: 'Untitled' },
  content: { type: String, default: '' },
  format: { type: String, enum: ['html', 'plain'], default: 'html' },
  color: { type: String, default: '#3b82f6' },
  visibility: { type: String, enum: ['private', 'project', 'event'], default: 'private' },
  shareWithTeam: { type: Boolean, default: false },
}, { timestamps: true });

userNoteSchema.index({ projectId: 1, visibility: 1 });
userNoteSchema.index({ calendarEventId: 1 });

userNoteSchema.plugin(tenantPlugin);

module.exports = mongoose.model('UserNote', userNoteSchema);
