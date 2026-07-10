const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const workspacePreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  /** Uppercase workspace names in display order */
  order: {
    type: [String],
    default: [],
  },
  updatedAt: {
    type: Date,
    default: () => new Date(),
  },
}, {
  collection: 'workspacePreferences',
});

workspacePreferenceSchema.plugin(tenantPlugin);
workspacePreferenceSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('WorkspacePreference', workspacePreferenceSchema);
