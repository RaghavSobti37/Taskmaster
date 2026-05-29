const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const pinBoardNoteSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

pinBoardNoteSchema.plugin(tenantPlugin);

module.exports = mongoose.model('PinBoardNote', pinBoardNoteSchema);
