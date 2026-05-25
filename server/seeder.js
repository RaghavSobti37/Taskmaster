const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Project = require('./models/Project');
const Phase = require('./models/Phase');
const Task = require('./models/Task');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    // 1. Clear existing data
    await User.deleteMany({});
    await Project.deleteMany({});
    await Phase.deleteMany({});
    await Task.deleteMany({});
    console.log('Database cleared.');

    // 2. Create Core Users
    const seedPassword = process.env.DEFAULT_SEED_PASSWORD || '1234';
    const admin = await User.create({
      name: 'Raghav Raj',
      email: 'REDACTED_ADMIN@example.com',
      password: seedPassword,
      role: 'admin',
      outletId: 'main',
      lastOnline: new Date()
    });

    await User.create({ name: 'Harshika', email: 'redacted-staff@example.com', password: seedPassword, role: 'admin', outletId: 'main' });
    await User.create({ name: 'Rohith', email: 'redacted-staff@example.com', password: seedPassword, role: 'admin', outletId: 'main' });
    await User.create({ name: 'Ops', email: 'ops@theshakticollective.in', password: seedPassword, role: 'admin', outletId: 'main' });
    await User.create({ name: 'Atharva', email: 'atharva@theshakticollective.in', password: seedPassword, role: 'admin', outletId: 'main' });

    console.log('Core Users Created: Raghav Raj, Harshika, Rohith, Ops, Atharva');

    // 3. Create Sample Project
    const project = await Project.create({
      name: 'Nexus Operation Alpha',
      description: 'Standardization of multi-tier project management hierarchies and roll-up calculations.',
      outletId: 'main',
      owner: admin._id,
      members: [admin._id]
    });
    console.log('Sample Project Created.');

    // 4. Create Phases
    const phase1 = await Phase.create({
      name: 'Phase 1: Architecture',
      projectId: project._id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      status: 'in-progress'
    });

    const phase2 = await Phase.create({
      name: 'Phase 2: Execution',
      projectId: project._id,
      dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      status: 'todo'
    });

    // 5. Create Tasks
    await Task.create({
      title: 'Database Schema Design',
      description: 'Define models for Projects, Phases, and Tasks.',
      status: 'done',
      priority: 'high',
      projectId: project._id,
      phaseId: phase1._id,
      assignees: [admin._id],
      progress: 100
    });

    await Task.create({
      title: 'Auth Middleware Implementation',
      status: 'in-progress',
      priority: 'critical',
      projectId: project._id,
      phaseId: phase1._id,
      assignees: [admin._id],
      progress: 40
    });

    await Task.create({
      title: 'Vite Frontend Shell',
      status: 'todo',
      priority: 'medium',
      projectId: project._id,
      phaseId: phase1._id,
      assignees: [admin._id],
      progress: 0
    });

    console.log('Seeding complete.');
    process.exit();
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedDatabase();
