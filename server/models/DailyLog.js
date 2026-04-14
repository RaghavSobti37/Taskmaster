import mongoose from 'mongoose';

const dailyLogSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  date: { 
    type: Date, 
    default: () => {
      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }
  },
  day: { 
    type: String, 
    default: () => {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[new Date().getDay()];
    }
  },
  tasksCompleted: { type: Number, default: 0 },
  tasksCreated: { type: Number, default: 0 },
  tasksUpdated: { type: Number, default: 0 },
  loginCount: { type: Number, default: 1 },
  lastLogin: { type: Date, default: Date.now },
  activities: [
    {
      action: String, // 'task_created', 'task_completed', 'task_updated', 'login', etc.
      description: String,
      timestamp: { type: Date, default: Date.now },
      metadata: mongoose.Schema.Types.Mixed
    }
  ],
  totalLoginTime: { type: Number, default: 0 }, // in minutes
  notes: { type: String, default: '' }
}, { timestamps: true });

// Compound index for efficient queries
dailyLogSchema.index({ userId: 1, date: -1 });

const DailyLog = mongoose.model('DailyLog', dailyLogSchema);
export default DailyLog;
