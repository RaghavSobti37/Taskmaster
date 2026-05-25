const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');


/**
 * EMI Installment Schema
 */
const EmiSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  leadRowId: { type: String, index: true }, // Legacy link
  installmentNo: { type: Number, required: true },
  dueDate: { type: String, required: true },
  amount: { type: String, required: true },
  status: { type: String, default: 'Pending' }, // Paid, Pending
  paidAt: { type: String },
}, { timestamps: true });

EmiSchema.plugin(tenantPlugin);

module.exports = mongoose.model('EMI', EmiSchema);
