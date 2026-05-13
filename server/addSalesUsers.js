require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

const dbUri = (process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot').trim();

const addUsers = async () => {
  try {
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB');

    const users = [
      { name: 'Vicky', email: 'vicky@theshakticollective.in', password: '1234', role: 'sales', gender: 'male' },
      { name: 'Aryaman', email: 'redacted-staff@example.com', password: '1234', role: 'sales', gender: 'male' }
    ];

    for (const u of users) {
      const exists = await User.findOne({ email: u.email });
      if (exists) {
        console.log(`User ${u.name} already exists.`);
        continue;
      }

      // We need to set avatar too
      const { getRandomAvatar } = require('./utils/avatarGenerator');
      u.avatar = getRandomAvatar(u.gender);

      await User.create(u);
      console.log(`User ${u.name} created successfully.`);
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

addUsers();
