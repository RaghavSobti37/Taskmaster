require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI_PROD || process.env.MONGODB_URI);
  const User = require('../models/User');
  const Task = require('../models/Task');
  const TaskAssignment = require('../models/TaskAssignment');

  const aryaman = await User.findOne({ email: 'aryaman@theshakticollective.in' });
  const assigns = await TaskAssignment.find({ userId: aryaman._id }).lean();
  const taskIds = assigns.map((a) => a.taskId);

  const tasks = await Task.find({
    $or: [{ _id: { $in: taskIds } }, { createdBy: aryaman._id }],
    status: { $nin: ['done'] },
  })
    .select('title status projectId createdBy actualHours')
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();

  console.log(JSON.stringify(tasks, null, 2));
  process.exit(0);
}

main();
