const mongoose = require('mongoose');

// Dynamic UI JSON-Schema configurations
const viewLayoutSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  entity: { type: String, required: true }, // e.g., 'Lead', 'Task'
  layout: { type: mongoose.Schema.Types.Mixed, required: true }, // Store the JSON configuration for the UI layout
  updatedAt: { type: Date, default: Date.now }
});

// One layout per entity per tenant
viewLayoutSchema.index({ tenantId: 1, entity: 1 }, { unique: true });

module.exports = mongoose.model('ViewLayout', viewLayoutSchema);
