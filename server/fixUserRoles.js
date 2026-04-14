import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const fixUserRoles = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // Valid roles
    const validRoles = ['user', 'lead', 'admin', 'server_admin'];

    // Find all users with potentially invalid roles
    const allUsers = await User.find({});
    console.log(`\nChecking ${allUsers.length} users...`);

    let invalidCount = 0;
    let fixedCount = 0;

    for (const user of allUsers) {
      // Check if role is invalid
      if (!validRoles.includes(user.role)) {
        console.log(`❌ Invalid role for ${user.username}: "${user.role}"`);
        invalidCount++;

        // Try to auto-fix based on email/username
        let newRole = 'user';
        
        // Check if should be server admin
        if (user.email?.toLowerCase().includes('raghav') || 
            user.username?.toLowerCase().includes('raghav')) {
          newRole = 'server_admin';
          console.log(`   → Fixing to: ${newRole}`);
        } else if (user.email?.toLowerCase().includes('admin')) {
          newRole = 'admin';
          console.log(`   → Fixing to: ${newRole}`);
        }

        // Update the role
        user.role = newRole;
        await user.save({ validateBeforeSave: false }); // Skip validation during save
        fixedCount++;
        console.log(`   ✓ Fixed`);
      } else {
        console.log(`✓ ${user.username}: ${user.role}`);
      }
    }

    console.log(`\n✓ Summary:`);
    console.log(`  Invalid roles found: ${invalidCount}`);
    console.log(`  Roles fixed: ${fixedCount}`);

    // Re-find Raghav and verify
    const raghav = await User.findOne({
      $or: [
        { username: /raghav/i },
        { email: /raghav/i }
      ]
    });

    if (raghav) {
      console.log(`\n✓ Raghav's role is now: ${raghav.role}`);
    }

    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
};

fixUserRoles();
