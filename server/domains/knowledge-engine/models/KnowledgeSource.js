const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const knowledgeSourceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['website', 'crm', 'artist', 'instagram', 'linkedin', 'youtube', 'gsc', 'ga4', 'newsletter', 'manual'],
      index: true,
    },
    label: { type: String, required: true, trim: true },
    status: { type: String, default: 'idle', enum: ['idle', 'syncing', 'ok', 'error'] },
    lastSyncAt: { type: Date },
    lastError: { type: String },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    connectedAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConnectedAccount' },
  },
  { timestamps: true },
);

knowledgeSourceSchema.plugin(tenantPlugin);

module.exports = mongoose.model('KnowledgeSource', knowledgeSourceSchema);
