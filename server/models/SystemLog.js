const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const { SEVERITY_VALUES, MODULE_VALUES } = require('../../shared/systemLogContract');

const relatedEntitySchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    id: { type: String, required: true },
  },
  { _id: false }
);

const systemLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  traceId: { type: String, required: true, index: true },
  contextId: { type: String, index: true },
  severity: { type: String, enum: SEVERITY_VALUES, required: true, index: true },
  module: { type: String, enum: MODULE_VALUES, required: true, index: true },
  message: { type: String, required: true },
  userVisible: { type: Boolean, default: false },
  actorId: { type: String, default: 'SYSTEM', index: true },
  route: { type: String },
  method: { type: String },
  httpStatus: { type: Number },
  errorCode: { type: String },
  payload: { type: mongoose.Schema.Types.Mixed },
  relatedEntities: [relatedEntitySchema],
  createdAt: { type: Date, default: Date.now, expires: '180d' },
});

systemLogSchema.index({ module: 1, severity: 1, timestamp: -1 });
systemLogSchema.index({ tenantId: 1, timestamp: -1 });
systemLogSchema.index({ traceId: 1, timestamp: 1 });

systemLogSchema.plugin(tenantPlugin);

module.exports = mongoose.model('SystemLog', systemLogSchema);
