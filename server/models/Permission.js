const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g., 'view_leads', 'edit_leads'
  description: { type: String }
});

module.exports = mongoose.model('Permission', permissionSchema);
