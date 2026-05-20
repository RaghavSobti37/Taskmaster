const mongoose = require('mongoose');

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
    enum: ['drive', 'sheet', 'presentation', 'docs', 'meet', 'other'],
    default: 'other'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);
