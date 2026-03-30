import dotenv from 'dotenv';
dotenv.config();

import connectDB from './config/db.js';
import User from './models/User.js';
import Task from './models/Task.js';
import bcrypt from 'bcryptjs';

const cleanAndCreateUser = async () => {
  try {
    console.log('🔄 Connecting to Database...');
    await connectDB();
    console.log('✅ Connected to Database');

    // Clear all tasks
    console.log('\n🗑️  Clearing all tasks...');
    const taskResult = await Task.deleteMany({});
    console.log(`✅ Deleted ${taskResult.deletedCount} tasks`);

    // Clear all users
    console.log('\n🗑️  Clearing all users...');
    const userResult = await User.deleteMany({});
    console.log(`✅ Deleted ${userResult.deletedCount} users`);

    // Create new user
    console.log('\n📝 Creating new user...');
    const newUser = new User({
      username: 'Raghav Raj Sobti',
      email: 'raghavishaan@gmail.com',
      password: 'Raghav@123', // You can change this
      role: 'user',
    });

    const salt = await bcrypt.genSalt(10);
    newUser.password = await bcrypt.hash(newUser.password, salt);
    
    await newUser.save();
    console.log('✅ New user created successfully!');
    console.log('\n📋 User Details:');
    console.log(`   Username: ${newUser.username}`);
    console.log(`   Email: ${newUser.email}`);
    console.log(`   Role: ${newUser.role}`);
    console.log(`   ID: ${newUser._id}`);
    console.log('\n🔑 Login Credentials:');
    console.log(`   Email/Username: raghavishaan@gmail.com`);
    console.log(`   Password: Raghav@123`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

cleanAndCreateUser();
