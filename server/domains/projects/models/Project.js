const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');
const { formatProjectName } = require('../../../utils/formatProjectName');

const applyProjectNameFormat = (doc) => {
  if (doc?.name) doc.name = formatProjectName(doc.name);
};


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
  color: { type: String, default: '#3b82f6' },
  workspace: { type: String, default: 'General' },
  starred: { type: Boolean, default: false },
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
projectSchema.pre('deleteOne', { document: true, query: false }, async function () {
  await mongoose.model('Phase').deleteMany({ projectId: this._id });
  await mongoose.model('Task').deleteMany({ projectId: this._id });
});

projectSchema.pre('save', function () {
  if (this.isModified('name') && this.name) {
    this.name = formatProjectName(this.name);
  }
});

projectSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate() || {};
  if (update.name) update.name = formatProjectName(update.name);
  if (update.$set?.name) update.$set.name = formatProjectName(update.$set.name);
  this.setUpdate(update);
});

['find', 'findOne'].forEach((hook) => {
  projectSchema.post(hook, (result) => {
    if (!result) return;
    if (Array.isArray(result)) result.forEach(applyProjectNameFormat);
    else applyProjectNameFormat(result);
  });
});

projectSchema.index({ outletId: 1, createdAt: -1 });
projectSchema.index({ owner: 1 });
projectSchema.index({ members: 1 });
projectSchema.index({ workspace: 1 });

projectSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Project', projectSchema);
