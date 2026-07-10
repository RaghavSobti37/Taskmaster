require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI_PROD;
const targetEmail = process.argv[2];
const targetRole = process.argv[3];

async function updateRole() {
  if (!uri) {
    console.error('❌ MONGODB_URI_PROD not found in .env');
    process.exit(1);
  }

  if (!targetEmail || !targetRole) {
    console.error('❌ Usage: node setUserRole.js <email> <role>');
    console.log('Valid Roles: admin, operations, sales, artist_management, user');
    process.exit(1);
  }

  console.log('🔗 Connecting to Production DB...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  
  const User = require('../models/User');
  
  const user = await User.findOne({ email: targetEmail.toLowerCase().trim() });
  
  if (!user) {
    console.error(`❌ User with email ${targetEmail} not found.`);
    process.exit(1);
  }

  const oldRole = user.role;
  user.role = targetRole;
  await user.save();

  console.log(`✅ Success! Updated ${user.name} from '${oldRole}' to '${targetRole}' in Production DB.`);
  process.exit(0);
}

updateRole().catch(err => {
  console.error('❌ Error updating role:', err.message);
  process.exit(1);
});
