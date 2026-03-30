import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    console.log('[DB] Connecting to MongoDB...');
    console.log('[DB] MONGO_URI exists:', !!process.env.MONGO_URI);
    
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 2,
    });
    
    console.log(`[DB] MongoDB Connected: ${conn.connection.host}`);
    console.log(`[DB] Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`[DB] Connection error: ${error.message}`);
    console.error('[DB] Stack:', error.stack);
    process.exit(1);
  }
};

export default connectDB;