const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  links: [{
    type: String,
    trim: true,
    validate: [arrayLimit, '{PATH} exceeds the limit of 3']
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

function arrayLimit(val) {
  return val.length <= 3;
}

module.exports = mongoose.model('Asset', assetSchema);
