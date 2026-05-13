const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  assignedRepId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String, required: true },
  webinarDates: { type: String },
  attended: { type: String, enum: ['Y', 'N'], default: 'N' },
  attendanceDurationMin: { type: Number, default: 0 },
  meaningfulConnect: { type: String, enum: ['YES', 'NO'], default: 'NO' },
  leadQuality: { type: String, enum: ['4', '3', '2', '1', 'Future 4'], default: '1' },
  callStatus: { 
    type: String, 
    enum: ['DNP', 'Switch Off/Wrong Number', 'Busy', 'Connected', 'Pending'], 
    default: 'Pending' 
  },
  leadStatus: { 
    type: String, 
    enum: ['Not Interested', 'Cold', 'Warm', 'Hot', 'Token Received', 'Converted', 'New'], 
    default: 'New' 
  },
  remarks: { type: String },
  planOption: { type: String, enum: ['One-Time', '3 Mo', '6 Mo', '9 Mo', 'None'], default: 'None' },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lockedAt: { type: Date },
  importId: { type: mongoose.Schema.Types.ObjectId, ref: 'CRMImport' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);
