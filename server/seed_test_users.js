const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

const users = [
  { name: 'test', email: 'test@example.com', password: '1234', role: 'admin' },
  { name: 'Harshika', email: 'harshika@theshakticollective.in', password: '1234', role: 'user' },
  { name: 'Rohith', email: 'rohith@theshakticollective.in', password: '1234', role: 'user' },
  { name: 'Raghav Raj', email: 'raghavraj@theshakticollective.in', password: '1234', role: 'user' },
  { name: 'Operations', email: 'ops@theshakticollective.in', password: '1234', role: 'user' },
  { name: 'Atharva', email: 'atharva@theshakticollective.in', password: '1234', role: 'user' },
];

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('DB connected');

    for (const u of users) {
      const exists = await User.findOne({ email: u.email });
      if (exists) {
        console.log(`User ${u.email} exists. Updating...`);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(u.password, salt);
        await User.findOneAndUpdate({ email: u.email }, { 
          name: u.name, 
          password: hashedPassword, 
          role: u.role,
          outletId: 'main' 
        });
      } else {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(u.password, salt);
        await User.create({ 
          ...u, 
          password: hashedPassword,
          outletId: 'main'
        });
        console.log(`Created ${u.email}`);
      }
    }
    console.log('Seeding done');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedUsers();
