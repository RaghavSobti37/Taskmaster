const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  domain: { type: String, unique: true, sparse: true }, // Optional custom domain
  status: { type: String, enum: ['active', 'suspended', 'trial'], default: 'trial' },
  contactEmail: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tenant', tenantSchema);
