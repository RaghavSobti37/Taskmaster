const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  targetCount: { type: Number, required: true },
  currentCount: { type: Number, default: 0 },
  expReward: { type: Number, required: true },
  actionType: { type: String, required: true }, // e.g., 'COMPLETE_TASK', 'INVITE_USER'
  completed: { type: Boolean, default: false },
  date: { type: Date, required: true }
});

module.exports = mongoose.model('DailyMission', schema);
