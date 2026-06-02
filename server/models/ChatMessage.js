const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  key: { type: String, default: '' },
  name: { type: String, default: '' },
  size: { type: Number, default: 0 },
  type: { type: String, default: '' },
}, { _id: false });

const assetMentionSchema = new mongoose.Schema({
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
  label: { type: String, default: '' },
}, { _id: false });

const chatMessageSchema = new mongoose.Schema({
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatChannel', required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, default: '' },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  assetMentions: [assetMentionSchema],
  attachments: [attachmentSchema],
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

chatMessageSchema.index({ channelId: 1, createdAt: -1 });
chatMessageSchema.index({ channelId: 1, deletedAt: 1 });

chatMessageSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
