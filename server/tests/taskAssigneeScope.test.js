const Project = require('../models/Project');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const User = require('../models/User');
const TaskService = require('../domains/tasks/services/TaskService');

const adminActor = (user) => ({
  ...user.toObject(),
  departmentId: { slug: 'admin', permissionPreset: 'admin' },
});

describe('task assignee scope', () => {
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

  test('project lead can assign project member on create', async () => {
    const { taskDto } = await TaskService.createTask(
      {
        title: 'Member create',
        projectId: sandbox._id,
        assignees: [projectMember._id.toString()],
      },
      adminActor(projectLead),
      null
    );

    expect(taskDto._id).toBeTruthy();
    expect(taskDto.createdBy?._id?.toString?.() || taskDto.createdBy?.toString?.())
      .toBe(projectLead._id.toString());
    const row = await TaskAssignment.findOne({ taskId: taskDto._id }).lean();
    expect(row.userId.toString()).toBe(projectMember._id.toString());
    expect(row.assignedBy.toString()).toBe(projectLead._id.toString());
  });

  test('project lead cannot assign off-project user on create', async () => {
    await expect(
      TaskService.createTask(
        {
          title: 'Off-project create',
          projectId: sandbox._id,
          assignees: [offProjectUser._id.toString()],
        },
        adminActor(projectLead),
        null
      )
    ).rejects.toThrow('Not authorized: assignee must be a project member');
  });

  test('project lead can reassign between project members; original creator preserved', async () => {
    const thirdMember = await User.create({
      name: 'Third Member',
      email: `third-scope-${Date.now()}@test.com`,
    });
    await Project.findByIdAndUpdate(sandbox._id, {
      $addToSet: { members: thirdMember._id },
      $push: { memberRoles: { user: thirdMember._id, role: 'member' } },
    });

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
      { assignees: [thirdMember._id.toString()] },
      adminActor(projectLead),
      null
    );

    const row = await TaskAssignment.findOne({ taskId: taskDto._id }).lean();
    expect(row.userId.toString()).toBe(thirdMember._id.toString());
    expect(row.assignedBy.toString()).toBe(projectLead._id.toString());
    const creatorId = updated.taskDto.createdBy?._id || updated.taskDto.createdBy;
    expect(creatorId.toString()).toBe(projectLead._id.toString());
  });

  test('project member assignee cannot assign off-project user', async () => {
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

    await expect(
      TaskService.updateTask(
        task._id,
        { assignees: [offProjectUser._id.toString()] },
        projectMember,
        null
      )
    ).rejects.toThrow('Not authorized: assignee must be a project member');
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

  test('reassign rejects off-project user', async () => {
    const { taskDto } = await TaskService.createTask(
      {
        title: 'Off-project reassign',
        projectId: sandbox._id,
        assignees: [projectMember._id.toString()],
      },
      adminActor(projectLead),
      null
    );

    await expect(
      TaskService.updateTask(
        taskDto._id,
        { assignees: [projectMember._id.toString(), offProjectUser._id.toString()] },
        adminActor(projectLead),
        null
      )
    ).rejects.toThrow('Not authorized: assignee must be a project member');
  });
});
