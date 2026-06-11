const User = require('../models/User');
const Project = require('../models/Project');
const Asset = require('../models/Asset');
const { canAccessProject } = require('../utils/projectAccess');
const { getScheduleForUser } = require('../services/scheduleService');
const {
  linkProjectCalendar,
  getProjectCalendarEvents,
} = require('../domains/integrations/controllers/googleController');
const { getAssets } = require('../controllers/assetController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('canAccessProject', () => {
  let owner;
  let member;
  let outsider;
  let project;

  beforeEach(async () => {
    owner = await User.create({ name: 'Owner', email: 'owner-access@test.com' });
    member = await User.create({ name: 'Member', email: 'member-access@test.com' });
    outsider = await User.create({ name: 'Outsider', email: 'outsider-access@test.com' });
    project = await Project.create({
      name: 'Access gate project',
      outletId: 'test-outlet',
      owner: owner._id,
      members: [member._id],
      status: 'active',
    });
  });

  test('owner and member can access; outsider cannot', () => {
    expect(canAccessProject(owner, project)).toBe(true);
    expect(canAccessProject(member, project)).toBe(true);
    expect(canAccessProject(outsider, project)).toBe(false);
  });

  test('populated member objects still grant access', () => {
    const populated = {
      ...project.toObject(),
      members: [{ _id: member._id, name: 'Member', email: 'member-access@test.com' }],
    };
    expect(canAccessProject(member, populated)).toBe(true);
    expect(canAccessProject(outsider, populated)).toBe(false);
  });
});

describe('SEC-A01 project calendar IDOR', () => {
  let owner;
  let outsider;
  let project;

  beforeEach(async () => {
    owner = await User.create({ name: 'Owner', email: 'owner-cal@test.com' });
    outsider = await User.create({ name: 'Outsider', email: 'outsider-cal@test.com' });
    project = await Project.create({
      name: 'Calendar project',
      outletId: 'test-outlet',
      owner: owner._id,
      members: [],
      status: 'active',
    });
  });

  test('linkProjectCalendar returns 403 for non-member', async () => {
    const req = {
      params: { id: project._id.toString() },
      user: outsider,
      body: { calendarId: 'primary' },
    };
    const res = mockRes();
    await linkProjectCalendar(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authorized to view this project' });
  });

  test('getProjectCalendarEvents returns 403 for non-member', async () => {
    const req = { params: { id: project._id.toString() }, user: outsider };
    const res = mockRes();
    await getProjectCalendarEvents(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authorized to view this project' });
  });

  test('owner can link calendar to own project', async () => {
    const req = {
      params: { id: project._id.toString() },
      user: owner,
      body: { calendarId: 'primary' },
    };
    const res = mockRes();
    await linkProjectCalendar(req, res);
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Calendar linked to project successfully' });
  });

  test('owner can read project calendar events (empty when no links)', async () => {
    const req = { params: { id: project._id.toString() }, user: owner };
    const res = mockRes();
    await getProjectCalendarEvents(req, res);
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith([]);
  });
});

describe('SEC-A02 schedule projectId IDOR', () => {
  let owner;
  let outsider;
  let project;

  beforeEach(async () => {
    owner = await User.create({ name: 'Owner', email: 'owner-sched@test.com' });
    outsider = await User.create({ name: 'Outsider', email: 'outsider-sched@test.com' });
    project = await Project.create({
      name: 'Schedule project',
      outletId: 'test-outlet',
      owner: owner._id,
      members: [],
      status: 'active',
    });
  });

  test('foreign projectId throws 403', async () => {
    await expect(
      getScheduleForUser({
        user: outsider,
        userId: outsider._id,
        projectId: project._id.toString(),
        start: '2026-06-01',
        end: '2026-06-30',
      })
    ).rejects.toMatchObject({ statusCode: 403, message: 'Not authorized to view this project' });
  });

  test('owner can load schedule for own project', async () => {
    const payload = await getScheduleForUser({
      user: owner,
      userId: owner._id,
      projectId: project._id.toString(),
      start: '2026-06-01',
      end: '2026-06-30',
    });
    expect(payload).toMatchObject({
      start: '2026-06-01',
      end: '2026-06-30',
      departments: expect.any(Array),
      tasks: expect.any(Array),
    });
  });
});

describe('SEC-A03 asset list scoping', () => {
  let owner;
  let outsider;
  let project;

  beforeEach(async () => {
    owner = await User.create({ name: 'Owner', email: 'owner-asset@test.com' });
    outsider = await User.create({ name: 'Outsider', email: 'outsider-asset@test.com' });
    project = await Project.create({
      name: 'Asset project',
      outletId: 'test-outlet',
      owner: owner._id,
      members: [],
      status: 'active',
    });
    await Asset.create({
      name: 'Secret asset',
      createdBy: owner._id,
      projectIds: [project._id],
    });
  });

  test('projectId query returns 403 for non-member', async () => {
    const req = { query: { projectId: project._id.toString() }, user: outsider };
    const res = mockRes();
    await getAssets(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('unscoped list excludes foreign project assets', async () => {
    const req = { query: {}, user: outsider };
    const res = mockRes();
    await getAssets(req, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('owner sees project assets via projectId filter', async () => {
    const req = { query: { projectId: project._id.toString() }, user: owner };
    const res = mockRes();
    await getAssets(req, res);
    const assets = res.json.mock.calls[0][0];
    expect(assets).toHaveLength(1);
    expect(assets[0].name).toBe('Secret asset');
  });
});
