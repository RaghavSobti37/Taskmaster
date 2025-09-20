import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import connectDB from './config/db.js';

dotenv.config();

connectDB();

const importData = async () => {
  try {
    // Clear existing users to avoid duplicates if run multiple times
    await User.deleteMany();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    const users = [
      {
        username: 'testuser',
        email: 'test@example.com',
        password: hashedPassword,
      },
      {
        username: 'test2',
        email: 'test2@example.com',
        password: hashedPassword,
      },
      {
        username: 'test3',
        email: 'test3@example.com',
        password: hashedPassword,
      },
    ];

    await User.insertMany(users);

    console.log('✅ Test users created successfully!');
    process.exit();
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await User.deleteMany();
    console.log('✅ All user data destroyed!');
    process.exit();
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}