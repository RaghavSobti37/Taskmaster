const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const { applyPersonIdentityToDoc } = require('../utils/personNormalization');

const OfficeContactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, index: true },
  phone: { type: String, index: true },
  role: { type: String },
  notes: { type: String },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

OfficeContactSchema.pre('save', function (next) {
  try {
    applyPersonIdentityToDoc(this);
    next();
  } catch (err) {
    next(err);
  }
});

OfficeContactSchema.index({ name: 'text', email: 'text', phone: 'text' });
OfficeContactSchema.plugin(tenantPlugin);

module.exports = mongoose.model('OfficeContact', OfficeContactSchema);
