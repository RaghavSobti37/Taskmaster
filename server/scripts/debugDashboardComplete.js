require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
const Task = require('../models/Task');
const Log = require('../models/Log');

const API = 'http://localhost:5000';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne();
  const task = await Task.findOne({ status: { $ne: 'done' } });
  if (!user || !task) {
    console.log('NO_DATA', { user: !!user, task: !!task });
    process.exit(0);
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}`, 'x-skip-toast': 'true' };

  console.log('TASK_BEFORE', { id: task._id, title: task.title, status: task.status });

  const putRes = await axios.put(
    `${API}/api/tasks/${task._id}`,
    { status: 'done', actualHours: (task.actualHours || 0) + 1 },
    { headers }
  ).catch((e) => ({ error: e.response?.data || e.message, status: e.response?.status }));

  if (putRes.error) {
    console.log('PUT_FAILED', putRes);
    process.exit(1);
  }

  console.log('PUT_OK', { returnedStatus: putRes.data.status, progress: putRes.data.progress });

  const logPayload = {
    action: 'DAILY_LOG',
    targetType: 'Task',
    targetId: task._id,
    details: {
      type: 'TASK_COMPLETION',
      title: task.title,
      timeSpent: '1h',
      project: 'General',
    },
  };

  const logRes = await axios.post(`${API}/api/logs`, logPayload, { headers }).catch((e) => ({ error: e.response?.data || e.message, status: e.response?.status }));

  if (logRes.error) {
    console.log('LOG_POST_FAILED', logRes);
  } else {
    console.log('LOG_POST_OK', { action: logRes.data.action, id: logRes.data._id });
  }

  const dailyLogs = await Log.find({
    userId: user._id,
    action: 'DAILY_LOG',
    createdAt: { $gte: new Date(Date.now() - 60000) }
  }).lean();
  const timeLogs = await Log.find({
    userId: user._id,
    action: 'TIME_LOG',
    createdAt: { $gte: new Date(Date.now() - 60000) }
  }).lean();

  console.log('RECENT_DAILY_LOGS', dailyLogs.length);
  console.log('RECENT_TIME_LOGS', timeLogs.length);

  const refreshed = await Task.findById(task._id).lean();
  console.log('TASK_AFTER', { status: refreshed.status, completedAt: refreshed.completedAt });

  await mongoose.disconnect();
})().catch((e) => {
  console.error('SCRIPT_ERROR', e.message);
  process.exit(1);
});
