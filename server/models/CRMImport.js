const mongoose = require('mongoose');

const crmImportSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  leadCount: { type: Number, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('CRMImport', crmImportSchema);
