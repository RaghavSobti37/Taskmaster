const mongoose = require('mongoose');
require('dotenv').config();
const Project = require('./models/Project');
const Task = require('./models/Task');
const User = require('./models/User');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding projects...');

    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('No admin user found. Seed users first.');
      process.exit();
    }

    // 1. Create 3 Projects
    const projects = [
      {
        name: 'Nexus Core Overhaul',
        description: 'Global infrastructure stabilization and performance optimization.',
        owner: admin._id,
        members: [admin._id],
        status: 'active',
        priority: 'high',
        category: 'Development',
        outletId: 'main'
      },
      {
        name: 'Personnel Network V2',
        description: 'Expanding operative data fields and biometric integration.',
        owner: admin._id,
        members: [admin._id],
        status: 'active',
        priority: 'medium',
        category: 'HR',
        outletId: 'main'
      },
      {
        name: 'Temporal Layout Engine',
        description: 'Advanced drag-and-drop calendar synchronization.',
        owner: admin._id,
        members: [admin._id],
        status: 'active',
        priority: 'low',
        category: 'R&D',
        outletId: 'main'
      }
    ];

    const createdProjects = await Project.insertMany(projects);
    console.log(`Created ${createdProjects.length} projects.`);

    // 2. Create 3 Calendar Events (Tasks with dueDate)
    const today = new Date();
    const tasks = [
      {
        title: 'System Security Audit',
        description: 'Comprehensive review of all nexus access points.',
        projectId: createdProjects[0]._id,
        assignees: [admin._id],
        dueDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
        priority: 'high',
        status: 'todo',
        outletId: 'main'
      },
      {
        title: 'Operative Performance Review',
        description: 'Evaluating output across all standard units.',
        projectId: createdProjects[1]._id,
        assignees: [admin._id],
        dueDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2),
        priority: 'medium',
        status: 'in-progress',
        outletId: 'main'
      },
      {
        title: 'Legacy Data Purge',
        description: 'Removing non-essential assets from the global cluster.',
        projectId: createdProjects[2]._id,
        assignees: [admin._id],
        dueDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3),
        priority: 'low',
        status: 'todo',
        outletId: 'main'
      }
    ];

    await Task.insertMany(tasks);
    console.log('Created 3 calendar events (tasks).');

    console.log('Seeding complete.');
    process.exit();
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedData();
