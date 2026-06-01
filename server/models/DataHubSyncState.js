const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const dataHubSyncStateSchema = new mongoose.Schema({
  configKey: { type: String, required: true, unique: true, default: 'incremental' },
  lastSyncedAt: { type: Date, default: null },
  lastFullSyncAt: { type: Date, default: null },
  lastStats: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

dataHubSyncStateSchema.plugin(tenantPlugin);

module.exports = mongoose.model('DataHubSyncState', dataHubSyncStateSchema);
