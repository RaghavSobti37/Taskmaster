import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g., 'CREATE_TASK', 'ASSIGN_TASK', 'COMPLETE_TASK'
  details: { type: Object }, // e.g., { taskId: '...', fromUser: '...', toUser: '...' }
}, { timestamps: true });

const Log = mongoose.model('Log', logSchema);
export default Log;