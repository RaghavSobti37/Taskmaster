const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const opsEntitySchema = new mongoose.Schema(
  {
    domain: { type: String, required: true, index: true },
    subtype: { type: String, default: '' },
    name: { type: String, required: true, trim: true },
    organization: { type: String, trim: true },
    city: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    status: { type: String, default: 'new', index: true },
    notes: { type: String },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastWeeklyTouchAt: { type: Date },
    createdWeekKey: { type: String, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

opsEntitySchema.index({ name: 'text', organization: 'text', city: 'text' });
opsEntitySchema.plugin(tenantPlugin);

module.exports = mongoose.model('OpsEntity', opsEntitySchema);
