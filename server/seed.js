const mongoose = require('mongoose');
const User = require('./models/User');
const Project = require('./models/Project');
const Task = require('./models/Task');
const Log = require('./models/Log');
const Team = require('./models/Team');
require('dotenv').config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to cluster...');

    // Clear everything except Root Admin
    const rootAdmin = await User.findOne({ email: 'test@example.com' });
    await User.deleteMany({ email: { $ne: 'test@example.com' } });
    await Project.deleteMany({});
    await Task.deleteMany({});
    await Log.deleteMany({});
    await Team.deleteMany({});

    console.log('Database purged. Keeping Root Admin:', rootAdmin?.email);

    // Create Teams
    const teams = ['SOCIAL MEDIA', 'EDITING', 'PR', 'SALES', 'SHOOT', 'TECH'];
    const teamDocs = await Promise.all(teams.map(name => Team.create({ name, createdBy: rootAdmin?._id })));

    // Create Dummy Users
    const users = [
      { name: 'Harshika', email: 'harshika@theshakticollective.in', role: 'user', teams: ['SOCIAL MEDIA', 'PR'] },
      { name: 'Rohith', email: 'rohith@theshakticollective.in', role: 'user', teams: ['EDITING', 'SHOOT'] },
      { name: 'Raghav Raj', email: 'raghavraj@theshakticollective.in', role: 'admin', teams: ['TECH', 'SALES'] },
      { name: 'Ops Node', email: 'ops@theshakticollective.in', role: 'user', teams: ['SALES'] },
      { name: 'Atharva', email: 'atharva@theshakticollective.in', role: 'user', teams: ['TECH'] },
    ];

    const userDocs = await Promise.all(users.map(u => User.create({ ...u, password: 'password123' })));
    console.log('Users seeded.');

    // Create Projects
    const projects = [
      { name: 'Nexus Core Expansion', description: 'Upgrading global operational nodes.', owner: rootAdmin?._id, members: [rootAdmin?._id, userDocs[0]._id, userDocs[1]._id], teams: ['TECH', 'EDITING'], progress: 35, outletId: 'main' },
      { name: 'Shakti Collective Brand', description: 'Identity overhaul and PR blitz.', owner: rootAdmin?._id, members: [rootAdmin?._id, userDocs[2]._id, userDocs[3]._id], teams: ['PR', 'SOCIAL MEDIA'], progress: 60, outletId: 'main' },
    ];

    const projectDocs = await Promise.all(projects.map(p => Project.create(p)));
    console.log('Projects seeded.');

    // Create Tasks
    const tasks = [
      { title: 'Database Optimization', description: 'Index core relationship tables.', status: 'todo', projectId: projectDocs[0]._id, assignees: [userDocs[4]._id], priority: 'high', outletId: 'main' },
      { title: 'Video Edit: Phase 1', description: 'Assemble raw footage for marketing.', status: 'in-progress', projectId: projectDocs[0]._id, assignees: [userDocs[1]._id], priority: 'medium', outletId: 'main' },
      { title: 'Finalize PR Kit', description: 'Consolidate all brand assets.', status: 'done', projectId: projectDocs[1]._id, assignees: [userDocs[0]._id], priority: 'critical', completedAt: new Date(), outletId: 'main' },
    ];

    await Task.insertMany(tasks);
    console.log('Tasks seeded.');

    console.log('Seed protocol complete.');
    process.exit();
  } catch (err) {
    console.error('Seed failure:', err);
    process.exit(1);
  }
};

seed();
