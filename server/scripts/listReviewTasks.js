require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const email = process.argv.find((a) => a.startsWith('--email='))?.split('=')[1]
    || 'REDACTED_ADMIN@example.com';
  const useProd = process.argv.includes('--prod') || process.env.MAIL_USE_PROD_DB === 'true';
  const uri = useProd
    ? process.env.MONGODB_URI_PROD || process.env.MONGODB_URI
    : process.env.MONGODB_URI;

  await mongoose.connect(uri);
  const User = require('../models/User');
  const Task = require('../models/Task');
  const TaskAssignment = require('../models/TaskAssignment');

  const user = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }
  console.log('User:', user.name, user._id.toString());

  const inReview = await Task.find({ status: 'in-review' })
    .select('title status projectId createdBy')
    .lean();
  console.log('\nAll in-review tasks:', inReview.length);

  for (const t of inReview) {
    const assigns = await TaskAssignment.find({ taskId: t._id })
      .populate('assignedBy', 'name email')
      .populate('userId', 'name email')
      .lean();
    const assigners = assigns.map((a) => ({
      assignee: a.userId?.name || a.userId,
      assignedBy: a.assignedBy?.name || a.assignedBy,
      assignedById: a.assignedBy?._id?.toString() || String(a.assignedBy),
      isYou: String(a.assignedBy?._id || a.assignedBy) === user._id.toString(),
    }));
    console.log('\n-', t.title);
    console.log('  taskId:', t._id.toString());
    console.log('  assignments:', JSON.stringify(assigners, null, 2));
  }

  const asAssigner = await TaskAssignment.find({ assignedBy: user._id })
    .populate('taskId', 'title status')
    .lean();
  console.log('\nAll tasks you assigned (any status):', asAssigner.length);
  asAssigner.forEach((a) => {
    console.log(` - ${a.taskId?.title || '?'} (${a.taskId?.status || 'missing task'})`);
  });

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
