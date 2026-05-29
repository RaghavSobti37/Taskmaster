const mongoose = require('mongoose');

const mailTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  format: { type: String, enum: ['rawHtml', 'visual'], default: 'visual' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('MailTemplate', mailTemplateSchema);
