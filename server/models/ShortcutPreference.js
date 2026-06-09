const mongoose = require('mongoose');

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

shortcutPreferenceSchema.index({ userId: 1 });

module.exports = mongoose.model('ShortcutPreference', shortcutPreferenceSchema);
