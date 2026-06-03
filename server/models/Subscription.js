const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const subscriptionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  dueDate: { type: Date, required: true },
  type: {
    type: String,
    default: 'Software',
    enum: ['Software', 'SaaS', 'Hosting', 'Domain', 'Service', 'Other'],
  },
  periodicity: {
    type: String,
    default: 'Monthly',
    enum: ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'One-time'],
  },
  paymentMode: {
    type: String,
    default: 'Credit Card',
    enum: ['Credit Card', 'Debit Card', 'UPI', 'Bank Transfer', 'Cash', 'Other'],
  },
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  notes: { type: String },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reminderSentForDueDate: { type: Date },
}, { timestamps: true });

subscriptionSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Subscription', subscriptionSchema);
