import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const makeRaghavServerAdmin = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // Find Raghav by username or email
    let user = await User.findOne({
      $or: [
        { username: 'Raghav' },
        { username: 'raghav' },
        { email: /raghav/i }
      ]
    });

    if (!user) {
      console.log('❌ Raghav user not found. Please create the account first.');
      process.exit(1);
    }

    console.log(`Found user: ${user.username} (${user.email})`);
    
    // Check if already server admin
    if (user.role === 'server_admin') {
      console.log('✓ User is already a server admin');
      process.exit(0);
    }

    // Make server admin and add firstName/lastName
    user.role = 'server_admin';
    user.firstName = user.firstName || 'Raghav';
    user.lastName = user.lastName || 'Sobti';

    await user.save();

    console.log('✓ Raghav has been promoted to SERVER_ADMIN');
    console.log(`Role: ${user.role}`);
    console.log(`First Name: ${user.firstName}`);
    console.log(`Last Name: ${user.lastName}`);

    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

makeRaghavServerAdmin();
