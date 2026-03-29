import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from './models/Task.js';
import connectDB from './config/db.js';

dotenv.config();

connectDB();

const clearAllTasks = async () => {
  try {
    const result = await Task.deleteMany({});
    console.log(`✅ All tasks cleared! Deleted ${result.deletedCount} tasks.`);
    process.exit();
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

clearAllTasks();
