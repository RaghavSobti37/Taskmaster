const mongoose = require('mongoose');

const emiSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  installmentNo: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
  paidAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('EMI', emiSchema);
