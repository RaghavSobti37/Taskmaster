const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Project = require('./models/Project');
const Phase = require('./models/Phase');
const TaskList = require('./models/TaskList');
const Task = require('./models/Task');

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    // 1. Clear existing data
    await User.deleteMany({});
    await Project.deleteMany({});
    await Phase.deleteMany({});
    await TaskList.deleteMany({});
    await Task.deleteMany({});
    console.log('Database cleared.');

    // 2. Create Test Users
    const admin = await User.create({
      name: 'Raghav Raj Sobti',
      email: 'raghavsobti37@gmail.com',
      password: 'password123',
      role: 'admin',
      outletId: 'main'
    });

    const standardUser = await User.create({
      name: 'Alice Operator',
      email: 'alice@coreknot.io',
      password: 'password123',
      role: 'user',
      outletId: 'main'
    });
    console.log('Test Users Created: Raghav (Admin), Alice (User)');

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

    // 5. Create Task Lists
    const list1 = await TaskList.create({
      name: 'System Design',
      phaseId: phase1._id,
      projectId: project._id,
      position: 1
    });

    const list2 = await TaskList.create({
      name: 'Backend Core',
      phaseId: phase1._id,
      projectId: project._id,
      position: 2
    });

    // 6. Create Tasks
    await Task.create({
      title: 'Database Schema Design',
      description: 'Define models for Projects, Phases, and Tasks.',
      status: 'done',
      priority: 'high',
      projectId: project._id,
      phaseId: phase1._id,
      taskListId: list1._id,
      assignees: [admin._id],
      progress: 100
    });

    await Task.create({
      title: 'Auth Middleware Implementation',
      status: 'in-progress',
      priority: 'critical',
      projectId: project._id,
      phaseId: phase1._id,
      taskListId: list2._id,
      assignees: [admin._id],
      progress: 40
    });

    await Task.create({
      title: 'Vite Frontend Shell',
      status: 'todo',
      priority: 'medium',
      projectId: project._id,
      phaseId: phase1._id,
      taskListId: list1._id,
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
