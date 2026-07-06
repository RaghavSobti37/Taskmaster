const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  targetCount: { type: Number, required: true },
  currentCount: { type: Number, default: 0 },
  expReward: { type: Number, required: true },
  actionType: { type: String, required: true }, // e.g., 'COMPLETE_TASK', 'INVITE_USER'
  cadence: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
  weekKey: { type: String }, // IST Monday date key for weekly missions
  completed: { type: Boolean, default: false },
  date: { type: Date, required: true }
});

schema.index({ tenantId: 1, userId: 1, date: 1 });
schema.plugin(tenantPlugin);

module.exports = mongoose.model('DailyMission', schema);
