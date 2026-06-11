const Project = require('../models/Project');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const User = require('../models/User');
const TaskService = require('../domains/tasks/services/TaskService');

const adminActor = (user) => ({
  ...user.toObject(),
  departmentId: { slug: 'admin', permissionPreset: 'admin' },
});

describe('task assignee scope (open assignment)', () => {
  let sandbox;
  let projectLead;
  let projectMember;
  let offProjectUser;
  let platformAdmin;

  beforeEach(async () => {
    projectLead = await User.create({
      name: 'Sandbox Lead',
      email: `lead-scope-${Date.now()}@test.com`,
    });
    projectMember = await User.create({
      name: 'Sandbox Member',
      email: `member-scope-${Date.now()}@test.com`,
    });
    offProjectUser = await User.create({
      name: 'Off Project',
      email: `off-scope-${Date.now()}@test.com`,
    });
    platformAdmin = await User.create({
      name: 'Platform Admin',
      email: `admin-scope-${Date.now()}@test.com`,
    });

    sandbox = await Project.create({
      name: `[TEST] SANDBOX ${Date.now()}`,
      outletId: 'test-outlet',
      owner: projectLead._id,
      members: [projectLead._id, projectMember._id],
      memberRoles: [
        { user: projectLead._id, role: 'admin' },
        { user: projectMember._id, role: 'member' },
      ],
      workspace: 'GENERAL',
      status: 'active',
    });
  });

  test('project lead can assign any tenant user on create', async () => {
    const { taskDto } = await TaskService.createTask(
      {
        title: 'Off-project create',
        projectId: sandbox._id,
        assignees: [offProjectUser._id.toString()],
      },
      adminActor(projectLead),
      null
    );

    expect(taskDto._id).toBeTruthy();
    expect(taskDto.createdBy?._id?.toString?.() || taskDto.createdBy?.toString?.())
      .toBe(projectLead._id.toString());
    const row = await TaskAssignment.findOne({ taskId: taskDto._id }).lean();
    expect(row.userId.toString()).toBe(offProjectUser._id.toString());
    expect(row.assignedBy.toString()).toBe(projectLead._id.toString());
  });

  test('project lead can assign any tenant user on update; assigner becomes creator', async () => {
    const { taskDto } = await TaskService.createTask(
      {
        title: 'Reassign scope',
        projectId: sandbox._id,
        assignees: [projectMember._id.toString()],
      },
      adminActor(projectLead),
      null
    );

    const updated = await TaskService.updateTask(
      taskDto._id,
      { assignees: [offProjectUser._id.toString()] },
      adminActor(projectLead),
      null
    );

    const row = await TaskAssignment.findOne({ taskId: taskDto._id }).lean();
    expect(row.userId.toString()).toBe(offProjectUser._id.toString());
    expect(row.assignedBy.toString()).toBe(projectLead._id.toString());
    const creatorId = updated.taskDto.createdBy?._id || updated.taskDto.createdBy;
    expect(creatorId.toString()).toBe(projectLead._id.toString());
  });

  test('project member assignee can assign any tenant user', async () => {
    const task = await Task.create({
      title: 'Member assign attempt',
      projectId: sandbox._id,
      createdBy: projectLead._id,
      status: 'todo',
    });
    await TaskAssignment.create({
      taskId: task._id,
      userId: projectMember._id,
      assignedBy: projectLead._id,
    });

    const updated = await TaskService.updateTask(
      task._id,
      { assignees: [offProjectUser._id.toString()] },
      projectMember,
      null
    );

    const row = await TaskAssignment.findOne({ taskId: task._id }).lean();
    expect(row.userId.toString()).toBe(offProjectUser._id.toString());
    const creatorId = updated.taskDto.createdBy?._id || updated.taskDto.createdBy;
    expect(creatorId.toString()).toBe(projectMember._id.toString());
  });

  test('platform admin not on project may assign off-project user', async () => {
    const { taskDto } = await TaskService.createTask(
      {
        title: 'Admin cross assign',
        projectId: sandbox._id,
        assignees: [offProjectUser._id.toString()],
      },
      adminActor(platformAdmin),
      null
    );

    expect(taskDto._id).toBeTruthy();
    const row = await TaskAssignment.findOne({ taskId: taskDto._id }).lean();
    expect(row.userId.toString()).toBe(offProjectUser._id.toString());
  });
});
