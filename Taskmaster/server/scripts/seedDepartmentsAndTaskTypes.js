#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { seedDepartments, mineTaskTypes } = require('../services/departmentService');

const run = async () => {
  const dbUri = (process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/testing').trim();
  await mongoose.connect(dbUri);
  console.log('Connected to MongoDB');

  const depts = await seedDepartments();
  console.log(`Departments seeded: ${depts.length}`);

  const result = await mineTaskTypes();
  console.log(`Task types mined: ${result.mined}, created: ${result.created}`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
