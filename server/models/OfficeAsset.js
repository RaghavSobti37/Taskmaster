const mongoose = require('mongoose');

const officeAssetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, default: 'Hardware' },
  currentlyWith: { type: String, default: 'Office' },
  status: { type: String, default: 'Available', enum: ['Available', 'In Use', 'Maintenance', 'Lost', 'Damaged'] },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  history: [{
    action: String,
    user: String,
    date: { type: Date, default: Date.now },
    notes: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('OfficeAsset', officeAssetSchema);
