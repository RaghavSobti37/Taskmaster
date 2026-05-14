const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Lead = require('../models/Lead');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmaster';

const repMapping = {
  'sr01': 'Rohit Sobti',
  'sr02': 'Deepank Soni',
  'sr03': 'Rinki Roy',
  'sr04': 'Raghav Sobti',
  'sr05': 'Sonesh Jain',
  'sr06': 'Satyam Mishra', // User said Satyam, mapping has Satyam Mishra
  'sr07': 'Shivam Sahijwani',
  'sr08': 'Harshika Kasliwal',
  'sr09': 'Aryaman'
};

const mapReps = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    for (const [id, name] of Object.entries(repMapping)) {
      // Find user by name (case-insensitive and partial match for Satyam)
      const query = name === 'Satyam Mishra' 
        ? { name: { $regex: new RegExp('Satyam', 'i') } } 
        : { name: { $regex: new RegExp(`^${name}$`, 'i') } };

      let user = await User.findOne(query);

      if (user) {
        user.repId = id;
        await user.save();
        console.log(`Updated User: ${user.name} with repId: ${id}`);
        
        // Optionally update leads if they are assigned by some other logic, 
        // but here assignedRepId should already be correct if import_leads.js was run.
        // If leads have a 'metadata.repId' or something, we could sync them here.
      } else {
        console.warn(`User not found for name: ${name}`);
      }
    }

    console.log('Rep mapping completed.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

mapReps();
