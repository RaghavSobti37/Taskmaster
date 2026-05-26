const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Project = require('./models/Project');
  const projects = await Project.find({}).lean();
  fs.writeFileSync('projects.json', JSON.stringify(projects, null, 2));
  console.log(`Saved ${projects.length} projects to projects.json`);
  await mongoose.disconnect();
}
run().catch(console.error);
