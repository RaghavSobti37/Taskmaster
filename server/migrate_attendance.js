const mongoose = require('mongoose');
require('dotenv').config();
const Attendance = require('./models/Attendance'); // Using relative path for the script in root

const runMigration = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const records = await Attendance.find({ 
      $or: [
        { timeIn: { $exists: true } }, 
        { timeOut: { $exists: true } }
      ] 
    });

    console.log(`Found ${records.length} legacy records to migrate`);

    let migrated = 0;
    for (const record of records) {
      // Create new sub-docs based on old flat fields if they exist
      const inTimeRecord = record.inTimeRecord || {};
      const outTimeRecord = record.outTimeRecord || {};

      if (record.timeIn && !inTimeRecord.timestamp) {
        inTimeRecord.timestamp = record.timeIn;
        inTimeRecord.workMode = record.workMode || 'wfh';
        inTimeRecord.checkInIp = record.checkInIp || '';
        inTimeRecord.isApproved = !!record.isApproved;
        inTimeRecord.approvedBy = record.approvedBy;
        inTimeRecord.verificationMethod = 'MANUAL';
      }

      if (record.timeOut && !outTimeRecord.timestamp) {
        outTimeRecord.timestamp = record.timeOut;
        outTimeRecord.workMode = record.workMode || 'wfh';
        outTimeRecord.checkOutIp = record.checkOutIp || '';
        outTimeRecord.isApproved = !!record.isApproved;
        outTimeRecord.approvedBy = record.approvedBy;
        outTimeRecord.verificationMethod = 'MANUAL';
      }

      const updatePayload = {
        $set: { inTimeRecord, outTimeRecord },
        $unset: { timeIn: "", timeOut: "", workMode: "", checkInIp: "", checkOutIp: "", isApproved: "", approvedBy: "" }
      };

      await Attendance.updateOne({ _id: record._id }, updatePayload);
      migrated++;
    }

    console.log(`Successfully migrated ${migrated} records.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
