const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Notification = require('../models/Notification');
const { checkOverdue } = require('../services/notificationService');
const { configureWebPush } = require('../services/pushNotificationService');

const log = (level, msg, meta = {}) => {
  console.log(`${new Date().toISOString()} [${level}] ${msg}${Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''}`);
};

async function main() {
  let exitCode = 0;
  const results = { ok: [], fail: [] };
  const pass = (m) => { results.ok.push(m); log('PASS', m); };
  const fail = (m) => { results.fail.push(m); log('FAIL', m); exitCode = 1; };

  await mongoose.connect(process.env.MONGODB_URI);
  log('INFO', 'MongoDB connected');

  const user = await User.findOne({ role: 'admin' }) || await User.findOne();
  if (!user) {
    fail('No user in DB');
    process.exit(1);
  }
  pass(`User: ${user.email}`);

  const pushConfigured = configureWebPush();
  pass(`Web Push configured: ${pushConfigured}`);
  pass(`User push subscriptions: ${user.pushSubscriptions?.length || 0}`);

  const testTitle = `[TEST-OVERDUE] ${Date.now()}`;
  const task = await Task.create({
    title: testTitle,
    status: 'todo',
    dueDate: new Date(Date.now() - 60 * 60 * 1000),
    notifiedOverdue: false,
    createdBy: user._id,
  });
  await TaskAssignment.create({ taskId: task._id, userId: user._id, role: 'assignee' });
  pass(`Created overdue task ${task._id}`);

  const beforeCount = await Notification.countDocuments({
    recipient: user._id,
    title: 'Overdue Task Alert',
    relatedTaskId: task._id,
  });

  await checkOverdue();

  const afterNotifications = await Notification.find({
    recipient: user._id,
    title: 'Overdue Task Alert',
    relatedTaskId: task._id,
  }).sort({ createdAt: -1 });

  const created = afterNotifications.length - beforeCount;
  if (created === 1) {
    pass(`Exactly 1 overdue notification created (id=${afterNotifications[0]._id})`);
  } else {
    fail(`Expected 1 notification, got ${created}`);
  }

  const updatedTask = await Task.findById(task._id).lean();
  if (updatedTask?.notifiedOverdue === true) {
    pass('Task marked notifiedOverdue=true');
  } else {
    fail('Task notifiedOverdue flag not set');
  }

  await checkOverdue();
  const afterSecondRun = await Notification.countDocuments({
    recipient: user._id,
    title: 'Overdue Task Alert',
    relatedTaskId: task._id,
  });
  if (afterSecondRun === afterNotifications.length) {
    pass('Second checkOverdue run did not duplicate notification');
  } else {
    fail(`Duplicate on second run: count went from ${afterNotifications.length} to ${afterSecondRun}`);
  }

  log('INFO', '--- DELIVERY NOTE ---');
  log('INFO', 'Server creates 1 DB row + 1 web push per assignee.');
  log('INFO', 'Client should show 1 OS toast (SW push). Polling fallback skipped when push subscribed.');
  if ((user.pushSubscriptions?.length || 0) > 0) {
    pass('User has push subscription — expect 1 toast with logo icon only');
  } else {
    log('INFO', 'No push subscription on user — OS toast only if browser open + permission granted (polling mode)');
  }

  await Notification.deleteMany({ relatedTaskId: task._id });
  await TaskAssignment.deleteMany({ taskId: task._id });
  await Task.findByIdAndDelete(task._id);
  log('INFO', 'Test data cleaned up');

  log('INFO', '--- SUMMARY ---', { passed: results.ok.length, failed: results.fail.length });
  results.fail.forEach((f) => log('FAIL', f));

  await mongoose.disconnect();
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
