import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import connectDB from './config/db.js';

dotenv.config();

connectDB();

const promoteUserToAdmin = async (username) => {
  try {
    const user = await User.findOne({ username });

    if (!user) {
      console.log(`❌ User "${username}" not found`);
      process.exit(1);
    }

    user.role = 'admin';
    await user.save();

    console.log(`✅ User "${username}" has been promoted to admin!`);
    console.log(`User Details:
- Username: ${user.username}
- Email: ${user.email}
- Role: ${user.role}`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

// Get username from command line arguments
const username = process.argv[2] || 'bluepolaroid05';
promoteUserToAdmin(username);
