import dotenv from 'dotenv';
dotenv.config();

import connectDB from './config/db.js';
import User from './models/User.js';

connectDB();

const makeAdmin = async () => {
  try {
    const user = await User.findOneAndUpdate(
      { username: 'raghav' },
      { role: 'admin' },
      { new: true }
    );

    if (user) {
      console.log(`✓ ${user.username} is now an admin`);
      console.log('User:', user);
    } else {
      console.log('User "raghav" not found');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

makeAdmin();
