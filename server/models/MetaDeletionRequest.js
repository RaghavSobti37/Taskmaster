const mongoose = require('mongoose');

const MetaDeletionRequestSchema = new mongoose.Schema({
  confirmationCode: { type: String, required: true, unique: true, index: true },
  metaUserId: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  artistsAffected: { type: Number, default: 0 },
  connectionsRemoved: { type: Number, default: 0 },
  completedAt: { type: Date },
  errorMessage: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('MetaDeletionRequest', MetaDeletionRequestSchema);
