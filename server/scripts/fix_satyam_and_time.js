const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Lead = require('../models/Lead');

const MONGO_URI = process.env.MONGODB_URI;

const fix = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Fix Satyam's User
    const satyamEmail = 'satyam@theshakticollective.in';
    let satyamUser = await User.findOne({ email: satyamEmail });
    
    if (!satyamUser) {
      console.log('Satyam user not found by email, creating...');
      satyamUser = await User.create({
        name: 'Satyam',
        email: satyamEmail,
        role: 'sales',
        repId: 'sr06'
      });
    } else {
      console.log('Updating Satyam user...');
      satyamUser.name = 'Satyam';
      satyamUser.repId = 'sr06';
      satyamUser.role = 'sales';
      await satyamUser.save();
    }
    console.log(`Satyam User ID: ${satyamUser._id}`);

    // 2. Sync Leads for Satyam (sr06)
    // Any leads that were previously assigned by name or ID but might be orphaned
    const leadsToUpdate = await Lead.find({ $or: [{ assignedRepId: null }, { assignedRepId: { $exists: false } }] });
    console.log(`Found ${leadsToUpdate.length} unassigned leads.`);
    
    // In import_leads.js, they might have been assigned to another user if name matched
    // But the user says "not able to see the leads for satyam".
    // I'll re-run the assignment for sr06
    const result = await Lead.updateMany(
      { metadata: { $exists: true }, "metadata.assignedRepId": "sr06" }, // If stored in metadata
      { assignedRepId: satyamUser._id }
    );
    console.log(`Updated ${result.modifiedCount} leads to Satyam by metadata.`);

    // Also check if any leads are assigned to "Satyam Mishra" (old user) and move them
    // AND check for the orphan ID found in inspection
    const orphanId = '6a05d16f4d042ea8e007923f';
    const orphanResult = await Lead.updateMany({ assignedRepId: orphanId }, { assignedRepId: satyamUser._id });
    console.log(`Recovered ${orphanResult.modifiedCount} leads from orphan ID ${orphanId} to Satyam.`);

    const otherSatyams = await User.find({ name: /Satyam/i, _id: { $ne: satyamUser._id } });
    for (const oldSatyam of otherSatyams) {
      const moveResult = await Lead.updateMany({ assignedRepId: oldSatyam._id }, { assignedRepId: satyamUser._id });
      console.log(`Moved ${moveResult.modifiedCount} leads from old Satyam (${oldSatyam.name}) to new Satyam.`);
    }

    // 3. Change default follow-up time to 11am
    // User said change from 5:30AM to 11am.
    // If time is missing or empty, set to 11:00
    const timeResult = await Lead.updateMany(
      { $or: [{ nextFollowupTime: "" }, { nextFollowupTime: null }, { nextFollowupTime: "05:30" }] },
      { $set: { nextFollowupTime: "11:00" } }
    );
    console.log(`Updated ${timeResult.modifiedCount} leads to 11:00 default follow-up time.`);

    console.log('Fix script completed.');
    process.exit(0);
  } catch (err) {
    console.error('Fix failed:', err);
    process.exit(1);
  }
};

fix();
