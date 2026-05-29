const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');
const Notification = require('../models/Notification');
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

  let listData;
  try {
    const list1 = await axios.get(`${API}/notifications`, { headers });
    listData = list1.data;
    const unreadInList = (listData.notifications || []).filter((n) => !n.read).length;
    pass(`GET /notifications -> ${listData.notifications?.length ?? 0} items, ${unreadInList} unread in list`);
    log('INFO', 'Allowed categories', { allowed: listData.allowedCategories });
  } catch (e) {
    fail(`GET /notifications: ${e.response?.data?.error || e.message}`);
  }

  let countsBefore;
  try {
    const counts = await axios.get(`${API}/notifications/status-counts`, { headers });
    countsBefore = counts.data;
    pass(`status-counts unread=${counts.data?.notifications?.unread}`);
  } catch (e) {
    fail(`status-counts: ${e.response?.data?.error || e.message}`);
  }

  if (listData && countsBefore) {
    const unreadInList = (listData.notifications || []).filter((n) => !n.read).length;
    const badge = countsBefore.notifications?.unread ?? -1;
    if (unreadInList === badge) {
      pass(`Badge matches inbox unread (${badge})`);
    } else {
      fail(`Badge mismatch: inbox shows ${unreadInList} unread, badge=${badge}`);
    }
  }

  const allowed = await getAllowedCategoriesForUser(user);
  const dbUnreadFilter = { recipient: user._id, read: false };
  if (user.role !== 'admin') dbUnreadFilter.category = { $in: allowed };
  const dbUnread = await Notification.countDocuments(dbUnreadFilter);
  log('INFO', 'DB unread (category-filtered)', { count: dbUnread, allowed });

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
    testId = created._id.toString();
    pass(`createNotification -> ${testId}`);
  } catch (e) {
    fail(`createNotification: ${e.message}`);
  }

  try {
    const list2 = await axios.get(`${API}/notifications`, { headers });
    const found = list2.data?.notifications?.find((n) => n._id === testId || n.title?.includes('[TEST]'));
    if (found) pass(`Test notification visible (read=${found.read})`);
    else fail('Test notification missing from GET /notifications');

    const counts2 = await axios.get(`${API}/notifications/status-counts`, { headers });
    const badgeAfter = counts2.data?.notifications?.unread;
    if (found && !found.read && badgeAfter >= 1) pass(`Badge incremented after create (unread=${badgeAfter})`);
    else if (found?.read) pass('Test was already read');
    else fail(`Badge did not increment (unread=${badgeAfter})`);

    if (found && !found.read) {
      const mark = await axios.patch(`${API}/notifications/${found._id}/read`, {}, { headers });
      if (mark.data?.read === true) pass('PATCH mark read');
      else fail('PATCH mark read failed');

      const counts3 = await axios.get(`${API}/notifications/status-counts`, { headers });
      const unreadAfterRead = (await axios.get(`${API}/notifications`, { headers })).data?.notifications?.filter((n) => !n.read).length;
      if (counts3.data?.notifications?.unread === unreadAfterRead) {
        pass(`Badge synced after read (unread=${unreadAfterRead})`);
      } else {
        fail(`Badge out of sync after read: badge=${counts3.data?.notifications?.unread}, list=${unreadAfterRead}`);
      }
    }
  } catch (e) {
    fail(`Verify flow: ${e.response?.data?.error || e.message}`);
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
