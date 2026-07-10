const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const Department = require('../models/Department');
const CalendarEvent = require('../models/CalendarEvent');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { mintSessionAgent } = require('./helpers/mintTestSession');
const { PRESET_PAGES } = require('../utils/pagePermissions');
const { buildDateTimeFromParts } = require('../utils/dateValidation');

async function ensureOpsDept() {
  let dept = await Department.findOne({ slug: 'ops' });
  if (!dept) {
    dept = await Department.create({
      name: 'Operations',
      slug: 'ops',
      permissionPreset: 'ops',
      pagePermissions: PRESET_PAGES.ops,
    });
  }
  return dept;
}

async function seedCalendarUser(tenantId, label) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dept = await ensureOpsDept();
  const email = `calendar-${label}-${stamp}@coreknot-test.local`;
  const user = await User.create({
    name: `Calendar ${label}`,
    email,
    password: DEV_DEFAULT_PASSWORD,
    gender: 'male',
    departmentId: dept._id,
    tenantId,
    pagePermissions: PRESET_PAGES.ops,
  });
  await TenantMembership.create({
    tenantId,
    userId: user._id,
    role: 'admin',
    status: 'active',
    joinedAt: new Date(),
  });
  const agent = request.agent(app);
  await mintSessionAgent(agent, user._id, { activeTenantId: String(tenantId) });
  return { agent, user, stamp };
}

describe('calendar tenant scope', () => {
  it('returns only events for the active organization', async () => {
    const stamp = Date.now();
    const tenantA = await Tenant.create({
      name: `Calendar A ${stamp}`,
      slug: `calendar-a-${stamp}`,
      contactEmail: `calendar-a-${stamp}@coreknot-test.local`,
    });
    const tenantB = await Tenant.create({
      name: `Calendar B ${stamp}`,
      slug: `calendar-b-${stamp}`,
      contactEmail: `calendar-b-${stamp}@coreknot-test.local`,
    });

    const { agent: agentA, user: userA } = await seedCalendarUser(tenantA._id, 'a');
    const { agent: agentB } = await seedCalendarUser(tenantB._id, 'b');

    const eventDate = buildDateTimeFromParts('2030-06-15', '10:00');
    await CalendarEvent.create({
      title: `Org A only ${stamp}`,
      description: 'tenant scoped',
      date: eventDate,
      endDate: eventDate,
      visibility: 'public',
      createdBy: userA._id,
      tenantId: tenantA._id,
    });

    const start = new Date('2030-06-01T00:00:00.000Z').toISOString();
    const end = new Date('2030-06-30T23:59:59.999Z').toISOString();

    const resA = await agentA.get('/api/calendar').query({ start, end });
    expect(resA.statusCode).toBe(200);
    expect(resA.body.some((ev) => ev.title === `Org A only ${stamp}`)).toBe(true);

    const resB = await agentB.get('/api/calendar').query({ start, end });
    expect(resB.statusCode).toBe(200);
    expect(resB.body.some((ev) => ev.title === `Org A only ${stamp}`)).toBe(false);

    await CalendarEvent.deleteMany({ title: `Org A only ${stamp}` });
    await Tenant.deleteMany({ _id: { $in: [tenantA._id, tenantB._id] } });
  });
});
