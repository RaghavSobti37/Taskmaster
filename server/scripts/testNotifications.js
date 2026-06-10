const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');
const { createNotification } = require('../services/notificationDispatcher');
const { getAllowedCategoriesForUser } = require('../utils/notificationCategories');

const API = 'http://localhost:5000/api';
const LOG_FILE = path.join(__dirname, '../logs/notification-test.log');

const log = (level, msg, meta = {}) => {
  const line = `${new Date().toISOString()} [${level}] ${msg}${Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''}`;
  console.log(line);
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(LOG_FILE, line + '\n');
};

async function main() {
  const results = { ok: [], fail: [] };
  const pass = (m) => { results.ok.push(m); log('PASS', m); };
  const fail = (m) => { results.fail.push(m); log('FAIL', m); };

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    log('INFO', 'MongoDB connected');
  } catch (e) {
    fail(`MongoDB: ${e.message}`);
    process.exit(1);
  }

  const user = await User.findOne({ role: 'admin' }) || await User.findOne();
  if (!user) {
    fail('No user in DB');
    process.exit(1);
  }
  pass(`User: ${user.email} (${user.role})`);

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const list1 = await axios.get(`${API}/notifications`, { headers });
    if (list1.data?.localOnly) pass('GET /notifications reports localOnly mode');
    else fail('GET /notifications missing localOnly flag');
  } catch (e) {
    fail(`GET /notifications: ${e.response?.data?.error || e.message}`);
  }

  try {
    const counts = await axios.get(`${API}/notifications/status-counts`, { headers });
    if (counts.data?.notifications?.localOnly) pass('status-counts reports localOnly notifications');
    else fail('status-counts missing localOnly flag');
  } catch (e) {
    fail(`status-counts: ${e.response?.data?.error || e.message}`);
  }

  const allowed = await getAllowedCategoriesForUser(user);
  log('INFO', 'Allowed categories', { allowed });

  let testId;
  try {
    const created = await createNotification({
      recipientId: user._id,
      title: '[TEST] Notification smoke test',
      message: `Automated test at ${new Date().toISOString()}`,
      category: 'system',
      type: 'system',
      actionUrl: '/inbox',
      sendEmail: false
    });
    testId = created?._id;
    if (testId) pass(`createNotification dispatched -> ${testId}`);
    else fail('createNotification returned no id');
  } catch (e) {
    fail(`createNotification: ${e.message}`);
  }

  try {
    const mark = await axios.patch(`${API}/notifications/${testId}/read`, {}, { headers });
    if (mark.data?.localOnly) pass('PATCH mark read stub OK');
    else fail('PATCH mark read missing localOnly');
  } catch (e) {
    fail(`PATCH mark read: ${e.response?.data?.error || e.message}`);
  }

  try {
    const vapid = await axios.get(`${API}/notifications/push/vapid-key`, { headers });
    if (vapid.data?.publicKey) pass(`VAPID configured (${vapid.data.publicKey.slice(0, 12)}...)`);
    else fail('VAPID public key empty');
  } catch (e) {
    fail(`vapid-key: ${e.response?.data?.error || e.message}`);
  }

  try {
    const sub = await axios.post(`${API}/notifications/push/subscribe`, {
      subscription: {
        endpoint: 'https://test.invalid/push/test-endpoint',
        keys: { p256dh: 'dGVzdA==', auth: 'dGVzdA==' }
      }
    }, { headers });
    if (sub.data?.success) pass('POST push/subscribe accepts payload');
    await axios.delete(`${API}/notifications/push/unsubscribe`, { data: { endpoint: 'https://test.invalid/push/test-endpoint' }, headers });
  } catch (e) {
    fail(`push/subscribe: ${e.response?.data?.error || e.message}`);
  }

  log('INFO', '--- SUMMARY ---', { passed: results.ok.length, failed: results.fail.length });
  console.log(`\nLog file: ${LOG_FILE}`);
  console.log(`Passed: ${results.ok.length}, Failed: ${results.fail.length}`);
  results.fail.forEach((f) => console.log(` - ${f}`));

  await mongoose.disconnect();
  process.exit(results.fail.length ? 1 : 0);
}

main().catch((e) => {
  log('ERROR', e.message);
  console.error(e);
  process.exit(1);
});
