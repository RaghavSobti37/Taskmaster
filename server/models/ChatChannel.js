const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const memberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  lastReadAt: { type: Date, default: null },
}, { _id: false });

const chatChannelSchema = new mongoose.Schema({
  type: { type: String, enum: ['project', 'dm', 'group'], required: true },
  /** @deprecated migrated to linkedProjectIds */
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  linkedProjectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
  workspace: { type: String, default: '' },
  name: { type: String, default: '' },
  dmKey: { type: String },
  members: [memberSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastMessageAt: { type: Date, default: null },
  lastMessagePreview: { type: String, default: '' },
}, { timestamps: true });

chatChannelSchema.index({ linkedProjectIds: 1 });
chatChannelSchema.index({ dmKey: 1 }, { unique: true, sparse: true });
chatChannelSchema.index({ 'members.user': 1, lastMessageAt: -1 });

chatChannelSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ChatChannel', chatChannelSchema);
