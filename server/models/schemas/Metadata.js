const mongoose = require('mongoose');

const MetadataSchema = new mongoose.Schema({
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customData: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

module.exports = MetadataSchema;
