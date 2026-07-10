const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const TaskService = require('../services/TaskService');
const {
  normalizeStoredProjectRole,
  getProjectRoleForUser,
  userIsProjectViewer,
  projectRoleRank,
} = require('../../shared/projectRoles');

describe('projectRoles', () => {
  test('normalizeStoredProjectRole preserves viewer', () => {
    expect(normalizeStoredProjectRole('viewer')).toBe('viewer');
    expect(normalizeStoredProjectRole('VIEWER')).toBe('viewer');
  });

  test('viewer rank stays below member', () => {
    expect(projectRoleRank('viewer')).toBe(20);
    expect(projectRoleRank('member')).toBe(40);
  });

  test('getProjectRoleForUser returns viewer from memberRoles', () => {
    const viewerId = '507f1f77bcf86cd799439011';
    const project = {
      owner: '507f1f77bcf86cd799439012',
      memberRoles: [{ user: viewerId, role: 'viewer' }],
    };
    expect(getProjectRoleForUser(project, viewerId)).toBe('viewer');
    expect(userIsProjectViewer(project, viewerId)).toBe(true);
  });
});

describe('TaskService viewer read-only', () => {
  let creator;
  let viewer;
  let project;

  beforeEach(async () => {
    creator = await User.create({ name: 'Creator', email: 'creator-viewer-role@test.com' });
    viewer = await User.create({ name: 'Viewer', email: 'viewer-role@test.com' });
    project = await Project.create({
      name: 'Viewer gate project',
      outletId: 'test-outlet',
      owner: creator._id,
      members: [viewer._id],
      memberRoles: [{ user: viewer._id, role: 'viewer' }],
      status: 'active',
    });
  });

  test('viewer cannot update project task even as creator or watcher', async () => {
    const task = await Task.create({
      title: 'Watch only',
      createdBy: viewer._id,
      projectId: project._id,
      status: 'todo',
      mentionAccessIds: [viewer._id],
    });

    await expect(
      TaskService.updateTask(task._id, { title: 'Viewer hijack' }, viewer, null)
    ).rejects.toThrow(/authorized/i);

    const unchanged = await Task.findById(task._id).lean();
    expect(unchanged.title).toBe('Watch only');
  });

  test('viewer cannot create project task', async () => {
    await expect(
      TaskService.createTask(
        {
          title: 'Viewer create attempt',
          projectId: project._id,
          status: 'todo',
        },
        viewer,
        null
      )
    ).rejects.toThrow(/authorized/i);
  });

  test('member can still update project task', async () => {
    const member = await User.create({ name: 'Member', email: 'member-viewer-role@test.com' });
    await Project.findByIdAndUpdate(project._id, {
      $push: {
        members: member._id,
        memberRoles: { user: member._id, role: 'member' },
      },
    });

    const task = await Task.create({
      title: 'Member task',
      createdBy: creator._id,
      projectId: project._id,
      status: 'todo',
    });

    await TaskService.updateTask(task._id, { title: 'Member edit' }, member, null);

    const updated = await Task.findById(task._id).lean();
    expect(updated.title).toBe('Member edit');
  });
});
