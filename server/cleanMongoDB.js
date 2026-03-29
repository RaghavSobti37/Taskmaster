import dotenv from 'dotenv';
dotenv.config();

import connectDB from './config/db.js';
import Log from './models/Log.js';

connectDB();

const cleanMongoDB = async () => {
  try {
    // Delete the entire logs collection
    const result = await Log.deleteMany({});
    
    console.log(`✓ Deleted ${result.deletedCount} log entries from MongoDB`);
    console.log('✓ Logs collection cleaned successfully');
    
    // Try to drop the collection
    try {
      await Log.collection.drop();
      console.log('✓ Log collection dropped');
    } catch (e) {
      console.log('✓ Log collection cleanup attempted');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning MongoDB:', error.message);
    process.exit(1);
  }
};

cleanMongoDB();
