const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Project = require('../models/Project');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  // 1. Handle Deepank
  let deepank = await User.findOne({ email: 'redacted-staff@example.com' });
  if (!deepank) {
    console.log('Deepank user not found. Creating user...');
    deepank = await User.create({
      name: 'Deepank',
      email: 'redacted-staff@example.com',
      password: process.env.DEFAULT_SEED_PASSWORD || '1234',
      role: 'artist_management',
      teams: []
    });
    console.log('Deepank user created successfully.');
  } else {
    deepank.role = 'artist_management';
    await deepank.save();
    console.log('Deepank user role updated to artist_management.');
  }

  // 2. Handle Harshika
  let harshika = await User.findOne({ email: 'redacted-staff@example.com' });
  if (harshika) {
    harshika.role = 'artist_management';
    await harshika.save();
    console.log('Harshika user role updated to artist_management.');
  } else {
    console.log('Harshika user not found.');
  }

  // 3. Add Deepank to all projects
  const projects = await Project.find({});
  console.log(`Found ${projects.length} projects to update.`);

  for (const project of projects) {
    let updated = false;

    // Add to members array
    if (!project.members.some(m => m.toString() === deepank._id.toString())) {
      project.members.push(deepank._id);
      updated = true;
    }

    // Add to memberRoles array
    if (!project.memberRoles.some(r => r.user && r.user.toString() === deepank._id.toString())) {
      project.memberRoles.push({
        user: deepank._id,
        role: 'artist_management'
      });
      updated = true;
    }

    if (updated) {
      await project.save();
      console.log(`Added Deepank to project: ${project.name}`);
    }
  }

  console.log('Migration completed successfully.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
