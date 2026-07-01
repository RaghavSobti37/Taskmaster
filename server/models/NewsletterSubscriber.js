const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const { personFields, applyPersonPreSave } = require('./personFields');

const NewsletterSubscriberSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', index: true },
  ...personFields,
  email: { type: String },
  subscribedAt: { type: Date, default: Date.now, index: true },
  source: { type: String, index: true },
  unsubscribed: { type: Boolean, default: false, index: true },
  unsubscribeReason: { type: String },
  importId: { type: mongoose.Schema.Types.ObjectId, ref: 'CRMImport' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

NewsletterSubscriberSchema.index({ email: 1 }, { unique: true, sparse: true });
applyPersonPreSave(NewsletterSubscriberSchema);
NewsletterSubscriberSchema.plugin(tenantPlugin);

module.exports = mongoose.model('NewsletterSubscriber', NewsletterSubscriberSchema);
