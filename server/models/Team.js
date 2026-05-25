const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');


const teamSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: { type: String },
  color: { type: String, default: '#3b82f6' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

teamSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Team', teamSchema);
