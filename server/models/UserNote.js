const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const userNoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  title: { type: String, default: 'Untitled' },
  content: { type: String, default: '' },
  color: { type: String, default: '#3b82f6' },
}, { timestamps: true });

userNoteSchema.plugin(tenantPlugin);

module.exports = mongoose.model('UserNote', userNoteSchema);
