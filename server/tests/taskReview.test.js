const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskActivity = require('../models/TaskActivity');
const TaskAssignment = require('../models/TaskAssignment');
const User = require('../models/User');
const TaskService = require('../services/TaskService');
const taskController = require('../domains/tasks/controllers/taskController');
const {
  needsReviewOnComplete,
  canUserApproveOrRollback,
} = require('../../shared/taskReviewRules');

describe('task review workflow', () => {
  let creator;
  let assignee;
  let platformOwner;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    creator = await User.create({ name: 'Creator', email: `creator-review-${stamp}@test.com` });
    assignee = await User.create({ name: 'Assignee', email: `assignee-review-${stamp}@test.com` });
    platformOwner = await User.create({
      name: 'Platform Owner',
      email: `platform-owner-review-${stamp}@test.com`,
    });
    process.env.PLATFORM_OWNER_USER_ID = platformOwner._id.toString();
  });

  test('delegated assignment requires review on complete', () => {
    const assignments = [{ userId: assignee._id, assignedBy: creator._id }];
    expect(
      needsReviewOnComplete(assignments, assignee._id)
    ).toBe(true);
  });

  test('self-assigned bug assignee skips review even when reporter created task', () => {
    const assignments = [{ userId: platformOwner._id, assignedBy: platformOwner._id }];
    expect(
      needsReviewOnComplete(assignments, platformOwner._id)
    ).toBe(false);
  });

  test('self-assigned creator can explicitly set in-review without auto-done', async () => {
    const task = await Task.create({
      title: 'Self review hold',
      createdBy: creator._id,
      status: 'in-progress',
    });
    await TaskAssignment.create({
      taskId: task._id,
      userId: creator._id,
      assignedBy: creator._id,
    });

    await TaskService.updateTask(task._id, { status: 'in-review' }, creator, null);

    const updated = await Task.findById(task._id).lean();
    expect(updated.status).toBe('in-review');
  });

  test('assignee re-submit after rollback routes back to in-review', async () => {
    const task = await Task.create({
      title: 'Delegated work',
      createdBy: creator._id,
      status: 'in-progress',
    });
    await TaskAssignment.create({
      taskId: task._id,
      userId: assignee._id,
      assignedBy: creator._id,
    });

    await TaskService.updateTask(
      task._id,
      { status: 'done', actualHours: 1 },
      assignee,
      null
    );

    let updated = await Task.findById(task._id).lean();
    expect(updated.status).toBe('in-review');

    await TaskService.updateTask(
      task._id,
      { reviewAction: 'rollback', rollbackReason: 'Missing acceptance criteria' },
      creator,
      null
    );

    updated = await Task.findById(task._id).lean();
    expect(updated.status).toBe('in-progress');

    const rollbackRow = await TaskActivity.findOne({ taskId: task._id, type: 'rollback' }).lean();
    expect(rollbackRow?.body).toBe('Missing acceptance criteria');
    expect(rollbackRow?.statusFrom).toBe('in-review');

    await TaskService.updateTask(
      task._id,
      { status: 'done', actualHours: 2 },
      assignee,
      null
    );

    updated = await Task.findById(task._id).lean();
    expect(updated.status).toBe('in-review');
  });

  test('creator can mark delegated task done without assignee completing', async () => {
    const task = await Task.create({
      title: 'Creator bypass',
      createdBy: creator._id,
      status: 'in-progress',
    });
    await TaskAssignment.create({
      taskId: task._id,
      userId: assignee._id,
      assignedBy: creator._id,
    });

    await TaskService.updateTask(task._id, { status: 'done' }, creator, null);

    const updated = await Task.findById(task._id).lean();
    expect(updated.status).toBe('done');
  });

  test('only creator can reopen completed task', async () => {
    const task = await Task.create({
      title: 'Done reopen',
      createdBy: creator._id,
      status: 'done',
      completedAt: new Date(),
      progress: 100,
    });
    await TaskAssignment.create({
      taskId: task._id,
      userId: assignee._id,
      assignedBy: creator._id,
    });

    await expect(
      TaskService.updateTask(
        task._id,
        { reviewAction: 'rollback', rollbackReason: 'Reopened for additional work' },
        assignee,
        null
      )
    ).rejects.toThrow('not allowed to roll back');

    await TaskService.updateTask(
      task._id,
      { reviewAction: 'rollback', rollbackReason: 'Reopened for additional work' },
      creator,
      null
    );

    const updated = await Task.findById(task._id).lean();
    expect(updated.status).toBe('in-progress');
    expect(updated.completedAt).toBeFalsy();

    const rollbackRow = await TaskActivity.findOne({ taskId: task._id, type: 'rollback' }).lean();
    expect(rollbackRow?.body).toBe('Reopened for additional work');
    expect(rollbackRow?.statusFrom).toBe('done');
  });

  test('assignee list edits preserve original assigner when assignees unchanged', async () => {
    const Project = require('../models/Project');
    const project = await Project.create({
      name: `[TEST] Preserve assigner ${Date.now()}`,
      outletId: 'test-outlet',
      owner: creator._id,
      members: [creator._id, assignee._id],
      memberRoles: [
        { user: creator._id, role: 'admin' },
        { user: assignee._id, role: 'member' },
      ],
      workspace: 'GENERAL',
      status: 'active',
    });
    const task = await Task.create({
      title: 'Preserve assigner',
      projectId: project._id,
      createdBy: creator._id,
      status: 'in-progress',
    });
    await TaskAssignment.create({
      taskId: task._id,
      userId: assignee._id,
      assignedBy: creator._id,
    });

    await TaskService.updateTask(
      task._id,
      { assignees: [assignee._id.toString()], title: 'Preserve assigner v2' },
      assignee,
      null
    );

    const row = await TaskAssignment.findOne({ taskId: task._id }).lean();
    expect(row.assignedBy.toString()).toBe(creator._id.toString());
    const persisted = await Task.findById(task._id).lean();
    expect(persisted.createdBy.toString()).toBe(creator._id.toString());
  });

  test('reassigning task preserves original creator', async () => {
    const Project = require('../models/Project');
    const otherAssignee = await User.create({
      name: 'Other Assignee',
      email: `other-assignee-${Date.now()}@test.com`,
    });
    const project = await Project.create({
      name: `[TEST] Reassign ${Date.now()}`,
      outletId: 'test-outlet',
      owner: creator._id,
      members: [creator._id, assignee._id, otherAssignee._id],
      memberRoles: [
        { user: creator._id, role: 'admin' },
        { user: assignee._id, role: 'member' },
        { user: otherAssignee._id, role: 'member' },
      ],
      workspace: 'GENERAL',
      status: 'active',
    });
    const task = await Task.create({
      title: 'Reassign creator',
      projectId: project._id,
      createdBy: creator._id,
      status: 'in-progress',
    });
    await TaskAssignment.create({
      taskId: task._id,
      userId: assignee._id,
      assignedBy: creator._id,
    });

    await TaskService.updateTask(
      task._id,
      { assignees: [otherAssignee._id.toString()] },
      assignee,
      null
    );

    const row = await TaskAssignment.findOne({ taskId: task._id }).lean();
    expect(row.userId.toString()).toBe(otherAssignee._id.toString());
    expect(row.assignedBy.toString()).toBe(assignee._id.toString());
    const persisted = await Task.findById(task._id).lean();
    expect(persisted.createdBy.toString()).toBe(creator._id.toString());
  });

  test('rollback requires a reason', async () => {
    const task = await Task.create({
      title: 'Rollback reason required',
      createdBy: creator._id,
      status: 'in-review',
    });
    await TaskAssignment.create({
      taskId: task._id,
      userId: assignee._id,
      assignedBy: creator._id,
    });

    await expect(
      TaskService.updateTask(task._id, { reviewAction: 'rollback' }, creator, null)
    ).rejects.toThrow('Rollback reason is required');
  });

  test('rollback on non-rollbackable status rejects with clear error (BUG-T13)', async () => {
    const task = await Task.create({
      title: 'In progress rollback',
      createdBy: creator._id,
      status: 'in-progress',
    });
    await TaskAssignment.create({
      taskId: task._id,
      userId: assignee._id,
      assignedBy: creator._id,
    });

    await expect(
      TaskService.updateTask(
        task._id,
        { reviewAction: 'rollback', rollbackReason: 'Should fail' },
        creator,
        null
      )
    ).rejects.toThrow('Only in-review or completed tasks can be rolled back');
  });

  test('updateTask controller maps rollback wrong-status to 400 (BUG-T13)', async () => {
    const fakeSession = {
      withTransaction: jest.fn(async (fn) => fn()),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(fakeSession);
    jest.spyOn(TaskService, 'updateTask').mockRejectedValue(
      new Error('Only in-review or completed tasks can be rolled back')
    );

    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { reviewAction: 'rollback' },
      user: { _id: new mongoose.Types.ObjectId() },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await taskController.updateTask(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Only in-review or completed tasks can be rolled back',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('platform owner can rollback in-review task they did not assign', async () => {
    const task = await Task.create({
      title: 'Owner rollback',
      createdBy: creator._id,
      status: 'in-review',
    });
    const assignments = [{
      taskId: task._id,
      userId: assignee._id,
      assignedBy: creator._id,
    }];
    await TaskAssignment.create(assignments);

    expect(
      canUserApproveOrRollback(platformOwner, assignments, {
        platformOwnerId: platformOwner._id.toString(),
      })
    ).toBe(true);

    await TaskService.updateTask(
      task._id,
      { reviewAction: 'rollback', rollbackReason: 'Owner revision' },
      platformOwner,
      null
    );

    const updated = await Task.findById(task._id).lean();
    expect(updated.status).toBe('in-progress');
  });
});
