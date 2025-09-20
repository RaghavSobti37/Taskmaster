import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  priority: {
    type: String,
    enum: ['normal', 'important', 'urgent'],
    default: 'normal',
  },
  status: {
    type: String,
    enum: ['todo', 'in-progress', 'done'],
    default: 'todo',
  },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPersonal: { type: Boolean, default: false },
  isVisibleInCircle: { type: Boolean, default: true },
  dueDate: { type: Date },
  completedAt: { type: Date },
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);
export default Task;