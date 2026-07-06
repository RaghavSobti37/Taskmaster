const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const shortcutPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  /** Sparse overrides: actionId -> { keys: string[] } or null (disabled) */
  bindings: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  updatedAt: {
    type: Date,
    default: () => new Date(),
  },
}, {
  collection: 'shortcutPreferences',
});

shortcutPreferenceSchema.plugin(tenantPlugin);
shortcutPreferenceSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ShortcutPreference', shortcutPreferenceSchema);
