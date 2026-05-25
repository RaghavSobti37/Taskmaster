const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const dailyMissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true }, // e.g., 'Complete 3 Tasks'
  type: { type: String, required: true }, // e.g., 'COMPLETE_TASK', 'CLOSE_LEAD'
  targetCount: { type: Number, required: true },
  currentCount: { type: Number, default: 0 },
  expReward: { type: Number, required: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  completed: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Ensure a user only has unique missions per day
dailyMissionSchema.index({ userId: 1, type: 1, date: 1 }, { unique: true });

dailyMissionSchema.plugin(tenantPlugin);

module.exports = mongoose.model('DailyMission', dailyMissionSchema);
