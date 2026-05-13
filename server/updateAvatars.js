const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const { getRandomAvatar } = require('./utils/avatarGenerator');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const updateAvatars = async () => {
  try {
    const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB...');

    const users = await User.find();
    console.log(`Found ${users.length} users. Updating avatars...`);

    for (const user of users) {
      user.avatar = getRandomAvatar(user.gender || 'male');
      await user.save();
    }

    console.log('All user avatars updated successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Update error:', err);
    process.exit(1);
  }
};

updateAvatars();
