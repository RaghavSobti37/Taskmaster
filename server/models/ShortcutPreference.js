const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const shortcutPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
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

module.exports = mongoose.model('ShortcutPreference', shortcutPreferenceSchema);
