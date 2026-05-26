const mongoose = require('mongoose');

const mailTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('MailTemplate', mailTemplateSchema);
