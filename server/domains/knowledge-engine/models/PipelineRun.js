const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const pipelineRunSchema = new mongoose.Schema(
  {
    jobType: { type: String, required: true, index: true },
    status: { type: String, default: 'running', enum: ['running', 'completed', 'failed'] },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    input: { type: mongoose.Schema.Types.Mixed, default: {} },
    output: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

pipelineRunSchema.plugin(tenantPlugin);

module.exports = mongoose.model('PipelineRun', pipelineRunSchema);
