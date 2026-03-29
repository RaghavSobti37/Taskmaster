import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  // Server logging fields (for admin panel)
  timestamp: {
    type: Date,
    default: Date.now,
  },
  level: {
    type: String,
    enum: ['info', 'warn', 'error'],
    default: 'info',
  },
  message: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    default: 'system',
  },
  
  // User action logging fields (backward compatibility)
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
  },
  action: { 
    type: String, 
  }, // e.g., 'CREATE_TASK', 'ASSIGN_TASK', 'COMPLETE_TASK'
  details: { 
    type: mongoose.Schema.Types.Mixed, 
  }, // e.g., { taskId: '...', fromUser: '...', toUser: '...' }
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
}, { timestamps: true });

// Auto-delete logs older than 30 days
logSchema.index(
  { timestamp: 1 },
  {
    expireAfterSeconds: 2592000, // 30 days
  }
);

const Log = mongoose.model('Log', logSchema);
export default Log;