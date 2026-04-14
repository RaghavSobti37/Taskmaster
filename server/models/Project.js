import mongoose from 'mongoose';

const clusterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      role: {
        type: String,
        enum: ['member', 'lead', 'coordinator'],
        default: 'member'
      },
      joinedAt: { type: Date, default: Date.now }
    }
  ],
  tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  creator: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'archived'],
    default: 'active'
  },
  members: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      role: {
        type: String,
        enum: ['member', 'lead', 'manager', 'admin'],
        default: 'member'
      },
      joinedAt: { type: Date, default: Date.now }
    }
  ],
  clusters: [clusterSchema],
  tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: null },
  visibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'private'
  },
  settings: {
    allowMemberInvite: { type: Boolean, default: true },
    requireApprovalForTasks: { type: Boolean, default: false },
    autoAssignTasks: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for efficient queries
projectSchema.index({ creator: 1, status: 1 });
projectSchema.index({ 'members.userId': 1 });

const Project = mongoose.model('Project', projectSchema);
export default Project;
