/**
 * QA sweep: Notifications & Daily Logs (e2e users)
 * Run: node server/scripts/qaNotifyLogsSweep.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const notificationDispatcher = require('../services/notificationDispatcher');
const dispatchedNotifications = [];
const origCreate = notificationDispatcher.createNotification;
notificationDispatcher.createNotification = async (...args) => {
  const payload = args[0] || {};
  dispatchedNotifications.push(payload);
  return origCreate.apply(notificationDispatcher, args);
};

const mongoose = require('mongoose');
const request = require('supertest');
const { loadConfig } = require('../config');
loadConfig();
const { createApp } = require('../app/createApp');
const { registerRoutes } = require('../app/registerRoutes');
const app = createApp();
registerRoutes(app);
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../domains/tasks/models/Task');
const TaskActivity = require('../domains/tasks/models/TaskActivity');
const TaskMentionReceipt = require('../models/TaskMentionReceipt');
const Log = require('../models/Log');
const Notification = require('../models/Notification');
const { generateSessionToken } = require('../utils/authSession');

const findings = [];

const pass = (id, msg) => {
  const f = { id, status: 'PASS', msg };
  findings.push(f);
  return f;
};
const fail = (id, msg, detail = '') => {
  const f = { id, status: 'FAIL', msg, detail };
  findings.push(f);
  return f;
};
const info = (id, msg) => {
  const f = { id, status: 'INFO', msg };
  findings.push(f);
  return f;
};

function authReq(user) {
  const token = generateSessionToken(user._id);
  const hdr = { Authorization: `Bearer ${token}` };
  return {
    get: (url) => request(app).get(url).set(hdr),
    post: (url) => request(app).post(url).set(hdr),
    put: (url) => request(app).put(url).set(hdr),
    delete: (url) => request(app).delete(url).set(hdr),
  };
}

async function waitForMongo() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI);
}

async function main() {
  await waitForMongo();

  const adminUser = await User.findOne({ email: 'e2e-dept-admin@test.coreknot.local' }).lean();
  const salesUser = await User.findOne({ email: 'e2e-dept-sales@test.coreknot.local' }).lean();
  const editorUser = await User.findOne({ email: 'e2e-dept-editor@test.coreknot.local' }).lean();
  const cgUser = await User.findOne({ email: 'e2e-dept-cg-artist@test.coreknot.local' }).lean();

  if (!adminUser || !salesUser) {
    console.error('E2E users missing — run seedE2eUsers.js');
    process.exit(1);
  }

  const sandbox = await Project.findOne({ name: '[E2E] SANDBOX' }).lean();
  const secondary = await Project.findOne({ name: '[E2E] SECONDARY' }).lean();
  if (!sandbox) {
    fail('setup', 'Missing [E2E] SANDBOX project');
    process.exit(1);
  }

  const cleanup = { taskIds: [], logIds: [] };
  const ts = Date.now();
  dispatchedNotifications.length = 0;

  // ── 1. Assign task admin → sales ──
  const createRes = await authReq(adminUser)
    .post('/api/tasks')
    .send({
      title: `[QA Notify] Assign ${ts}`,
      description: 'Assignment notification test',
      projectId: sandbox._id.toString(),
      assignees: [salesUser._id.toString()],
    });

  let taskId = createRes.body?._id;
  if (createRes.status !== 201 || !taskId) {
    fail('1-assign-notify', 'Task create with assignee failed', JSON.stringify(createRes.body));
  } else {
    cleanup.taskIds.push(taskId);
    const assignmentActivity = await TaskActivity.findOne({ taskId, type: 'assignment', assigneeId: salesUser._id }).lean();
    if (assignmentActivity) pass('1-assign-activity', 'Assignment recorded in TaskActivity');
    else fail('1-assign-activity', 'No assignment row in TaskActivity');

    const assignNotify = dispatchedNotifications.find(
      (n) => n.recipientId?.toString?.() === salesUser._id.toString() && n.title === 'New Task Assigned'
    );
    if (assignNotify) pass('1-assign-notify', 'Assignment notification dispatched to sales assignee');
    else fail('1-assign-notify', 'No assignment notification payload for sales assignee');

    const notifCount = await Notification.countDocuments({ recipient: salesUser._id, relatedTaskId: taskId });
    if (notifCount === 0) {
      info('1-assign-db', 'Notification model unused — client-local inbox via WebSocket (by design)');
    }

    const notifApi = await authReq(salesUser).get('/api/notifications');
    if (notifApi.body?.localOnly) {
      info('1-assign-api', 'GET /notifications returns localOnly stub — client persists via NotificationBridge');
    }
  }

  // ── 2. Mention in task comment ──
  if (taskId) {
    const beforeMentionCount = dispatchedNotifications.length;
    const msgRes = await authReq(adminUser)
      .post(`/api/tasks/${taskId}/activity`)
      .send({ body: 'Hey @E2E Sales please check this' });

    if (msgRes.status === 201) {
      pass('2-mention-post', 'Comment posted on task');
      const msgActivity = await TaskActivity.findOne({ taskId, type: 'message' }).sort({ createdAt: -1 }).lean();
      const mentioned = (msgActivity?.mentionedUserIds || []).map(String);
      if (mentioned.includes(salesUser._id.toString())) pass('2-mention-resolve', 'Mention resolved to sales user');
      else fail('2-mention-resolve', 'Mention not resolved', `ids=${JSON.stringify(mentioned)}`);

      const receipt = await TaskMentionReceipt.findOne({ userId: salesUser._id, taskId }).lean();
      if (receipt?.unreadCount > 0) pass('2-mention-receipt', `TaskMentionReceipt unreadCount=${receipt.unreadCount}`);
      else fail('2-mention-receipt', 'No TaskMentionReceipt bump');

      const mentionNotify = dispatchedNotifications.slice(beforeMentionCount).find(
        (n) => n.recipientId?.toString?.() === salesUser._id.toString() && /mentioned you/i.test(n.message || '')
      );
      if (mentionNotify) pass('2-mention-notify', 'Mention notification dispatched');
      else info('2-mention-notify', 'No mention notification — assignee may be skipped (already assigned)');
    } else {
      fail('2-mention-post', 'Failed to post mention comment', JSON.stringify(msgRes.body));
    }
  }

  // ── 3. Daily log visibility ──
  const logTitle = `[QA Notify] Daily log ${ts}`;
  const createLog = await authReq(salesUser)
    .post('/api/logs')
    .send({
      action: 'DAILY_LOG',
      targetType: 'Manual',
      details: { title: logTitle, timeSpent: '1h', type: 'MANUAL' },
    });

  if (createLog.status === 201) {
    cleanup.logIds.push(createLog.body._id);
    pass('3-log-create', 'Sales user created daily log');

    const salesLogs = await authReq(salesUser).get('/api/logs?limit=20');
    const salesOwn = (salesLogs.body || []).filter((l) => l.details?.title === logTitle);
    if (salesOwn.length >= 1) pass('3-log-self', 'Sales sees own daily log');
    else fail('3-log-self', 'Sales cannot see own daily log');

    const salesOther = await authReq(salesUser).get(`/api/logs?userId=${adminUser._id}&limit=5`);
    if (salesOther.status === 403) pass('3-log-scope-user', 'Non-admin blocked from other user logs');
    else fail('3-log-scope-user', 'Non-admin can query other user logs', `status=${salesOther.status}`);

    const adminLogs = await authReq(adminUser).get('/api/logs?limit=50');
    const adminSeesSales = (adminLogs.body || []).some((l) => l.details?.title === logTitle);
    if (adminSeesSales) pass('3-log-admin-all', 'Admin sees all daily logs including sales entry');
    else fail('3-log-admin-all', 'Admin cannot see sales daily log in unfiltered list');
  } else {
    fail('3-log-create', 'Daily log create failed', JSON.stringify(createLog.body));
  }

  // ── 4. Status change in activity history ──
  if (taskId) {
    const statusRes = await authReq(salesUser)
      .put(`/api/tasks/${taskId}`)
      .send({ status: 'in-progress' });

    if (statusRes.status === 200) {
      const statusActivity = await TaskActivity.findOne({ taskId, type: 'status_change' }).sort({ createdAt: -1 }).lean();
      if (statusActivity?.statusTo) {
        pass('4-status-activity', `Status change recorded: ${statusActivity.statusFrom} → ${statusActivity.statusTo}`);
      } else fail('4-status-activity', 'No status_change row after PUT status');

      const activityApi = await authReq(adminUser).get(`/api/tasks/${taskId}/activity`);
      const hasStatus = (activityApi.body || []).some((a) => a.type === 'status_change');
      if (hasStatus) pass('4-status-api', 'GET /tasks/:id/activity includes status_change');
      else fail('4-status-api', 'Activity API missing status_change');
    } else {
      fail('4-status-change', 'Status update failed', JSON.stringify(statusRes.body));
    }
  }

  // ── 5a. Assign user not on project (non-admin project lead) ──
  const videoUser = await User.findOne({ email: 'e2e-dept-videographer@test.coreknot.local' }).lean();
  if (secondary && videoUser) {
    const badAssign = await authReq(videoUser)
      .post('/api/tasks')
      .send({
        title: `[QA Notify] Bad assign ${ts}`,
        projectId: secondary._id.toString(),
        assignees: [salesUser._id.toString()],
      });
    if (badAssign.status >= 400) {
      pass('5a-not-on-project', `Off-project assignee rejected (${badAssign.body?.error || badAssign.status})`);
    } else if (badAssign.body?._id) {
      cleanup.taskIds.push(badAssign.body._id);
      info('5a-not-on-project', 'Off-project assignee allowed — no assignee membership validation (admin/manager can delegate cross-team)');
    }
  }

  // Admin bypass documented separately
  if (secondary) {
    const adminCross = await authReq(adminUser)
      .post('/api/tasks')
      .send({
        title: `[QA Notify] Admin cross ${ts}`,
        projectId: secondary._id.toString(),
        assignees: [salesUser._id.toString()],
      });
    if (adminCross.status === 201 && adminCross.body?._id) {
      cleanup.taskIds.push(adminCross.body._id);
      info('5a-admin-cross', 'Admin can assign off-project users (canAssignTasks bypass)');
    }
  }

  // ── 5b. Completed task edges ──
  if (taskId && editorUser) {
    await authReq(adminUser).put(`/api/tasks/${taskId}`).send({ status: 'done' });

    const msgOnDone = await authReq(adminUser)
      .post(`/api/tasks/${taskId}/activity`)
      .send({ body: 'Should fail on done task' });
    if (msgOnDone.status === 400) pass('5b-msg-done', 'Comment on completed task blocked');
    else fail('5b-msg-done', 'Comment allowed on completed task', JSON.stringify(msgOnDone.body));

    const beforeReassign = dispatchedNotifications.length;
    const reassignDone = await authReq(adminUser)
      .put(`/api/tasks/${taskId}`)
      .send({ assignees: [editorUser._id.toString(), salesUser._id.toString()] });
    if (reassignDone.status === 200) {
      info('5b-assign-done', 'Reassign on completed task allowed');
      const editorNotify = dispatchedNotifications.slice(beforeReassign).find(
        (n) => n.recipientId?.toString?.() === editorUser._id.toString() && n.title === 'New Task Assigned'
      );
      if (!editorNotify) {
        fail('5c-reassign-notify', 'BUG: PUT assignee change does not dispatch assignment notification');
      } else {
        pass('5c-reassign-notify', 'Reassign via PUT dispatches assignment notification');
      }
    } else {
      info('5b-assign-done', `Reassign on completed task blocked: ${reassignDone.body?.error || reassignDone.status}`);
    }
  }

  // ── 5d. Delete task purges history ──
  const delTask = await authReq(adminUser)
    .post('/api/tasks')
    .send({
      title: `[QA Notify] Delete me ${ts}`,
      projectId: sandbox._id.toString(),
      assignees: [adminUser._id.toString()],
    });
  if (delTask.status === 201) {
    const delId = delTask.body._id;
    await authReq(adminUser).put(`/api/tasks/${delId}`).send({ status: 'in-progress' });
    const preCount = await TaskActivity.countDocuments({ taskId: delId });
    const delRes = await authReq(adminUser).delete(`/api/tasks/${delId}`);
    if (delRes.status === 200) {
      const postCount = await TaskActivity.countDocuments({ taskId: delId });
      if (postCount === 0 && preCount > 0) {
        pass('5d-delete-purge', `Task delete purged ${preCount} activity rows (expected)`);
      } else {
        fail('5d-delete-purge', 'Activity not purged on delete', `pre=${preCount} post=${postCount}`);
      }
    } else {
      fail('5d-delete-purge', 'Task delete failed', JSON.stringify(delRes.body));
    }
  }

  // Cleanup
  for (const id of cleanup.taskIds) {
    await Task.findByIdAndDelete(id).catch(() => {});
    await TaskActivity.deleteMany({ taskId: id }).catch(() => {});
    await TaskMentionReceipt.deleteMany({ taskId: id }).catch(() => {});
  }
  for (const id of cleanup.logIds) {
    await Log.findByIdAndDelete(id).catch(() => {});
  }

  notificationDispatcher.createNotification = origCreate;

  const fails = findings.filter((f) => f.status === 'FAIL');
  for (const f of findings) {
    console.log(`[${f.status}] ${f.id}: ${f.msg}${f.detail ? ` — ${f.detail}` : ''}`);
  }
  console.log(`\nFindings: ${findings.length} total, ${fails.length} FAIL`);

  if (mongoose.connection.readyState === 1 && process.env.NODE_ENV !== 'test') {
    await mongoose.disconnect();
  }
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
