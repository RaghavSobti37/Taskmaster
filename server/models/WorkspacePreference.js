const mongoose = require('mongoose');

const workspacePreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
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

module.exports = mongoose.model('WorkspacePreference', workspacePreferenceSchema);
