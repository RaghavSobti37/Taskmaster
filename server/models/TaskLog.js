import mongoose from 'mongoose';

const taskLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    date: {
      type: String,
      required: true,
      default: () => new Date().toISOString().split('T')[0]
    },
    tasks: [
      {
        taskId: String,
        taskTitle: {
          type: String,
          required: true
        },
        hoursSpent: {
          type: Number,
          required: true,
          min: 0
        },
        status: {
          type: String,
          enum: ['completed', 'in_progress', 'blocked', 'pending'],
          default: 'in_progress'
        },
        description: String,
        completedAt: Date
      }
    ],
    totalHours: {
      type: Number,
      default: 0
    },
    notes: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

// Index for faster queries
taskLogSchema.index({ userId: 1, date: 1 });

const TaskLog = mongoose.model('TaskLog', taskLogSchema);
export default TaskLog;
