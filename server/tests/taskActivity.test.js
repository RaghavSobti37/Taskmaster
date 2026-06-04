const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskActivity = require('../models/TaskActivity');
const TaskMentionReceipt = require('../models/TaskMentionReceipt');
const User = require('../models/User');
const TaskAssignment = require('../models/TaskAssignment');
const TaskActivityService = require('../services/TaskActivityService');
const TaskService = require('../services/TaskService');
const { purgeStaleTaskActivity } = require('../services/taskActivityPurgeService');
const { COMPLETED_VISIBLE_DAYS, getCompletedTasksCutoff } = require('../utils/taskListFilter');

describe('TaskActivityService', () => {
  let creator;
  let assignee;
  let mentioned;

  beforeEach(async () => {
    creator = await User.create({ name: 'QA Creator', email: 'qa-creator-activity@test.com' });
    assignee = await User.create({ name: 'Assignee User', email: 'assignee-activity@test.com' });
    mentioned = await User.create({ name: 'Harshika Overseer', email: 'harshika-activity@test.com' });
  });

  test('seedCreatedAndAssignments writes created metadata and initial message row', async () => {
    const task = await Task.create({
      title: 'Build website',
      description: 'Initial brief from creator',
      createdBy: creator._id,
      status: 'todo',
    });

    const assignments = [
      { userId: assignee._id, assignedBy: creator._id },
      { userId: mentioned._id, assignedBy: creator._id },
    ];
    await TaskAssignment.insertMany(assignments.map((a) => ({ taskId: task._id, ...a })));

    await TaskActivityService.seedCreatedAndAssignments(task, assignments, creator, null);

    const rows = await TaskActivity.find({ taskId: task._id }).sort({ createdAt: 1 }).lean();
    expect(rows[0].type).toBe('created');
    expect(rows.some((r) => r.type === 'status_change')).toBe(false);
    expect(rows.some((r) => r.type === 'field_change')).toBe(false);
    expect(rows.some((r) => r.type === 'message' && r.body === 'Initial brief from creator')).toBe(true);
    expect(rows.filter((r) => r.type === 'assignment')).toHaveLength(2);
  });

  test('appendTaskMessage skips unchanged body', async () => {
    const task = await Task.create({
      title: 'Skip dup',
      description: 'Same text',
      createdBy: creator._id,
      status: 'todo',
    });

    const { activity } = await TaskActivityService.appendTaskMessage({
      task,
      user: creator,
      body: 'Same text',
      previousBody: 'Same text',
      session: null,
    });
    expect(activity).toBeNull();
    expect(await TaskActivity.countDocuments({ taskId: task._id, type: 'message' })).toBe(0);
  });

  test('postMessage notifies mentions and increments unread receipt', async () => {
    const task = await Task.create({
      title: 'Content task',
      createdBy: creator._id,
      status: 'in-progress',
    });
    await TaskAssignment.create({ taskId: task._id, userId: assignee._id, assignedBy: creator._id });

    const body = `Please upload assets @${creator.name.split(' ')[0]}`;
    const { mentionPayloads } = await TaskActivityService.postMessage(task._id, assignee, body, null);

    const messages = await TaskActivity.find({ taskId: task._id, type: 'message' });
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toContain('@');

    expect(mentionPayloads.some((p) => p.recipientId === creator._id.toString())).toBe(true);

    const receipt = await TaskMentionReceipt.findOne({ userId: creator._id, taskId: task._id });
    expect(receipt?.unreadCount).toBeGreaterThanOrEqual(1);
  });

  test('markMentionsRead clears unread count', async () => {
    const task = await Task.create({ title: 'Ping task', createdBy: creator._id, status: 'todo' });
    await TaskMentionReceipt.create({ userId: assignee._id, taskId: task._id, unreadCount: 2 });

    await TaskActivityService.markMentionsRead(task._id, assignee._id);
    const receipt = await TaskMentionReceipt.findOne({ userId: assignee._id, taskId: task._id });
    expect(receipt.unreadCount).toBe(0);
  });

  test('purgeStaleTaskActivity removes activity for done tasks past visibility cutoff', async () => {
    const cutoff = getCompletedTasksCutoff();
    const staleDate = new Date(cutoff.getTime() - 24 * 60 * 60 * 1000);

    const staleTask = await Task.create({
      title: 'Old done',
      createdBy: creator._id,
      status: 'done',
      completedAt: staleDate,
    });
    const freshTask = await Task.create({
      title: 'Recent done',
      createdBy: creator._id,
      status: 'done',
      completedAt: new Date(),
    });

    await TaskActivity.insertMany([
      { taskId: staleTask._id, type: 'created', body: '', actorId: creator._id },
      { taskId: freshTask._id, type: 'created', body: '', actorId: creator._id },
    ]);
    await TaskMentionReceipt.create({ userId: assignee._id, taskId: staleTask._id, unreadCount: 1 });

    const result = await purgeStaleTaskActivity();
    expect(result.taskCount).toBeGreaterThanOrEqual(1);

    const staleLeft = await TaskActivity.countDocuments({ taskId: staleTask._id });
    const freshLeft = await TaskActivity.countDocuments({ taskId: freshTask._id });
    expect(staleLeft).toBe(0);
    expect(freshLeft).toBe(1);

    const receiptLeft = await TaskMentionReceipt.countDocuments({ taskId: staleTask._id });
    expect(receiptLeft).toBe(0);
  });
});

describe('TaskService updateTask message activity', () => {
  test('updateTask records field_change when category or slot changes', async () => {
    const actor = await User.create({ name: 'Field Updater', email: 'field-updater@test.com' });
    const task = await Task.create({
      title: 'Field task',
      createdBy: actor._id,
      status: 'todo',
      type: 'general',
      scheduleSlot: 'FULL',
    });

    await TaskService.updateTask(
      task._id,
      { type: 'feature', scheduleSlot: 'AM' },
      actor,
      null
    );

    const categoryRow = await TaskActivity.findOne({
      taskId: task._id,
      type: 'field_change',
      fieldKey: 'category',
    }).lean();
    expect(categoryRow?.valueFrom).toBe('general');
    expect(categoryRow?.valueTo).toBe('feature');

    const slotRow = await TaskActivity.findOne({
      taskId: task._id,
      type: 'field_change',
      fieldKey: 'slot',
    }).lean();
    expect(slotRow?.valueFrom).toBe('FULL');
    expect(slotRow?.valueTo).toBe('AM');
  });

  test('updateTask records status_change when status changes on save', async () => {
    const actor = await User.create({ name: 'Status Updater', email: 'status-updater@test.com' });
    const task = await Task.create({
      title: 'Status via update',
      createdBy: actor._id,
      status: 'todo',
    });

    await TaskService.updateTask(
      task._id,
      { status: 'in-progress', progress: 50 },
      actor,
      null
    );

    const row = await TaskActivity.findOne({ taskId: task._id, type: 'status_change' }).lean();
    expect(row?.statusFrom).toBe('todo');
    expect(row?.statusTo).toBe('in-progress');
    expect(row?.actorId.toString()).toBe(actor._id.toString());
  });

  test('recordStatusChange writes status_change activity', async () => {
    const actor = await User.create({ name: 'Status Actor', email: 'status-actor@test.com' });
    const task = await Task.create({
      title: 'Status task',
      createdBy: actor._id,
      status: 'todo',
    });

    await TaskActivityService.recordStatusChange(task._id, actor, 'todo', 'in-progress', null);

    const row = await TaskActivity.findOne({ taskId: task._id, type: 'status_change' }).lean();
    expect(row?.statusFrom).toBe('todo');
    expect(row?.statusTo).toBe('in-progress');
  });

  test('appendTaskMessage on save path records new description as message', async () => {
    const creator = await User.create({ name: 'Updater', email: 'updater-activity@test.com' });
    const task = await Task.create({
      title: 'Update me',
      description: 'First line',
      createdBy: creator._id,
      status: 'todo',
    });

    const { activity } = await TaskActivityService.appendTaskMessage({
      task,
      user: creator,
      body: 'Second line with @Updater',
      previousBody: 'First line',
      session: null,
    });

    expect(activity?.body).toBe('Second line with @Updater');
    expect(await TaskActivity.countDocuments({ taskId: task._id, type: 'message' })).toBe(1);
  });
});

describe('taskListFilter purge alignment', () => {
  test('COMPLETED_VISIBLE_DAYS matches activity purge window (2 days)', () => {
    expect(COMPLETED_VISIBLE_DAYS).toBe(2);
    expect(getCompletedTasksCutoff()).toBeInstanceOf(Date);
  });
});
