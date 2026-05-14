const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const emails = [
  'aryaman@theshakticollective.in',
  'atharva@theshakticollective.in',
  'deepank@theshakticollective.in',
  'harshika@theshakticollective.in',
  'mahesh@theshakticollective.in',
  'raghavraj@theshakticollective.in',
  'rohith@theshakticollective.in',
  'sandesh@theshakticollective.in',
  'satyam@theshakticollective.in',
  'srinivas@theshakticollective.in'
];

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  for (const email of emails) {
    const namePart = email.split('@')[0];
    const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    const existing = await User.findOne({ email: email.toLowerCase() });
    
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${namePart}`;

    if (existing) {
      console.log(`User ${email} already exists. Updating avatar...`);
      existing.avatar = avatar;
      if (!existing.password) {
        existing.password = '1234';
      }
      await existing.save();
    } else {
      console.log(`Creating user: ${name} (${email})`);
      await User.create({
        name,
        email: email.toLowerCase(),
        password: '1234',
        role: 'sales',
        avatar
      });
    }
  }

  // Also assign random avatars to all users who don't have one
  const allUsers = await User.find();
  for (const user of allUsers) {
    if (!user.avatar) {
      user.avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name.replace(/\s+/g, '')}`;
      await user.save();
    }
  }

  console.log('Setup completed successfully.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
