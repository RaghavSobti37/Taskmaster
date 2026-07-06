const mongoose = require('mongoose');

const clerkSyncEventSchema = new mongoose.Schema({
  clerkEventId: { type: String, required: true, unique: true, index: true },
  eventType: { type: String, required: true, index: true },
  payloadHash: { type: String, required: true },
  processedAt: { type: Date, default: Date.now },
  success: { type: Boolean, default: false },
  error: { type: String, default: '' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('ClerkSyncEvent', clerkSyncEventSchema);
