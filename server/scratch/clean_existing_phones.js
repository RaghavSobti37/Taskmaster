const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot';
const Lead = require('../models/Lead');
const { normalizePhone } = require('../utils/sanitizer');

async function run() {
  try {
    await mongoose.connect(dbUri);
    console.log('Connected to DB');

    const leads = await Lead.find({});
    console.log(`Found ${leads.length} leads. Preparing bulk update...`);

    const operations = [];
    for (const lead of leads) {
      const origPhone = lead.phone;
      const cleanPhone = normalizePhone(origPhone);
      
      const origEmail = lead.email;
      const cleanEmail = origEmail ? origEmail.toLowerCase().trim() : '';

      let needsUpdate = false;
      const updateData = {};
      if (origPhone !== cleanPhone) {
        updateData.phone = cleanPhone;
        needsUpdate = true;
      }
      if (origEmail && origEmail !== cleanEmail) {
        updateData.email = cleanEmail;
        needsUpdate = true;
      }

      if (needsUpdate) {
        operations.push({
          updateOne: {
            filter: { _id: lead._id },
            update: { $set: updateData }
          }
        });
      }
    }

    if (operations.length > 0) {
      console.log(`Executing bulkWrite for ${operations.length} leads...`);
      const result = await Lead.bulkWrite(operations);
      console.log(`bulkWrite completed. Modified: ${result.modifiedCount}`);
    } else {
      console.log('All leads already normalized!');
    }

    // Force run a single backup to CSV at the very end
    const backgroundQueue = require('../services/backgroundQueue');
    backgroundQueue.enqueueCSVBackup();
    
    // Give queue a second to write CSV
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('Completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
