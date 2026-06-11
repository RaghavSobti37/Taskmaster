const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const schema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  closed: { type: String, default: '' },
  moved: { type: String, default: '' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.index({ projectId: 1, userId: 1 }, { unique: true });
schema.plugin(tenantPlugin);

module.exports = mongoose.model('ProjectKRA', schema);
