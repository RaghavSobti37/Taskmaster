const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  outletId: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  memberRoles: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, default: 'member' }
  }],
  status: { type: String, enum: ['active', 'archived', 'completed'], default: 'active' },
  tags: [{ type: String }],
  teams: [{ type: String }],
  progress: { type: Number, default: 0 },
  totalTasksCount: { type: Number, default: 0 },
  completedTasksCount: { type: Number, default: 0 },
  linkedCalendars: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    calendarId: { type: String, default: 'primary' }
  }],
  createdAt: { type: Date, default: Date.now }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

projectSchema.virtual('phases', {
  ref: 'Phase',
  localField: '_id',
  foreignField: 'projectId'
});

// Cascade deletes to Phase and Task models
projectSchema.pre('remove', async function(next) {
  await mongoose.model('Phase').deleteMany({ projectId: this._id });
  await mongoose.model('Task').deleteMany({ projectId: this._id });
  next();
});

projectSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  await mongoose.model('Phase').deleteMany({ projectId: this._id });
  await mongoose.model('Task').deleteMany({ projectId: this._id });
  next();
});

projectSchema.index({ outletId: 1, createdAt: -1 });
projectSchema.index({ owner: 1 });
projectSchema.index({ members: 1 });

module.exports = mongoose.model('Project', projectSchema);
