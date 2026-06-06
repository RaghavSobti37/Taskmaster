const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const { applyPersonIdentityToDoc } = require('../utils/personNormalization');

const EMAIL_STATUS_ENUM = ['Active', 'Unsubscribed', 'Invalid', 'Pending', 'Bounced'];

const personFields = {
  name: { type: String, required: true },
  nameKey: { type: String, index: true },
  email: { type: String, index: true },
  phone: { type: String, index: true },
  city: { type: String },
  emailStatus: { type: String, enum: EMAIL_STATUS_ENUM, default: 'Pending', index: true },
};

function applyPersonPreSave(schema) {
  schema.pre('save', function (next) {
    try {
      applyPersonIdentityToDoc(this);
      next();
    } catch (err) {
      next(err);
    }
  });
  schema.index({ name: 'text', email: 'text', phone: 'text' });
  schema.index({ createdAt: -1 });
}

module.exports = { personFields, applyPersonPreSave, EMAIL_STATUS_ENUM };
