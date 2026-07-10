require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI_PROD || process.env.MONGODB_URI);
  const TaskAssignment = require('../models/TaskAssignment');
  const rows = await TaskAssignment.find({
    taskId: { $in: ['6a18044956be78e63f457866', '6a18046256be78e63f45790e'] },
  })
    .populate('assignedBy', 'name')
    .populate('userId', 'name')
    .lean();
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

main();
