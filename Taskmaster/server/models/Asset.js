const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');


const assetSchema = new mongoose.Schema({
  projectIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  name: {
    type: String,
    required: true,
    trim: true
  },
  link: {
    type: String,
    trim: true,
    default: ''
  },
  type: {
    type: String,
    enum: ['drive', 'sheet', 'presentation', 'docs', 'meet', 'zoom', 'other'],
    default: 'other'
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

assetSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Asset', assetSchema);
