const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Project = mongoose.models.Project || mongoose.model('Project', new mongoose.Schema({ name: String }, { strict: false }));
  const Task = mongoose.models.Task || mongoose.model('Task', new mongoose.Schema({ title: String, description: String, status: String, projectId: mongoose.Schema.Types.ObjectId }, { strict: false }));

  const techProject = await Project.findOne({ name: /tech/i });
  if (!techProject) {
    console.log('Tech project not found');
    process.exit(0);
  }
  const tasks = await Task.find({ projectId: techProject._id }).where('status').ne('done');
  tasks.forEach((t, i) => {
    console.log(`\n--- Task ${i + 1} ---`);
    console.log(`Title: ${t.title}`);
    console.log(`Description: ${t.description}`);
  });
  process.exit(0);
});
