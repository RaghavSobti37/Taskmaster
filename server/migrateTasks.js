require('dotenv').config();
const mongoose = require('mongoose');
const Task = require('./models/Task');
const TaskAssignment = require('./models/TaskAssignment');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // get all tasks that don't have assignments yet, we can do this via raw documents since assignees was removed from schema but exists in DB
  const db = mongoose.connection.db;
  const tasks = await db.collection('tasks').find({ assignees: { $exists: true, $not: { $size: 0 } } }).toArray();

  let count = 0;
  for (const task of tasks) {
    if (task.assignees && task.assignees.length > 0) {
      for (const assignee of task.assignees) {
        await TaskAssignment.updateOne(
          { taskId: task._id, userId: assignee },
          { $set: { taskId: task._id, userId: assignee, assignedAt: task.createdAt } },
          { upsert: true }
        );
        count++;
      }
      
      // Optionally remove assignees from task document
      // await db.collection('tasks').updateOne({ _id: task._id }, { $unset: { assignees: "" } });
    }
  }

  console.log(`Migrated ${count} assignments`);
  process.exit(0);
}

migrate().catch(console.error);
