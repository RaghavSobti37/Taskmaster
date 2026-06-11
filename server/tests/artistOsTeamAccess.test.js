const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Department = require('../models/Department');
const Artist = require('../models/Artist');
const ArtistGig = require('../models/ArtistGig');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { PRESET_PAGES } = require('../utils/pagePermissions');

async function ensureSalesDept() {
  let dept = await Department.findOne({ slug: 'sales' });
  if (!dept) {
    dept = await Department.create({
      name: 'Sales',
      slug: 'sales',
      permissionPreset: 'sales',
      pagePermissions: PRESET_PAGES.sales,
    });
  }
  return dept;
}

async function registerAndLogin(agent, email, name) {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      name,
      email,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
    });
  expect(reg.statusCode).toBe(201);

  const login = await agent.post('/api/auth/login').send({
    email,
    password: DEV_DEFAULT_PASSWORD,
  });
  expect(login.statusCode).toBe(200);
  return reg.body._id;
}

describe('Artist OS team member HTTP access', () => {
  let artist;
  let teamAgent;
  let outsiderAgent;

  beforeEach(async () => {
    const salesDept = await ensureSalesDept();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    teamAgent = request.agent(app);
    outsiderAgent = request.agent(app);

    const teamMemberId = await registerAndLogin(
      teamAgent,
      `team-${stamp}@coreknot-test.local`,
      'Team Member'
    );
    const outsiderId = await registerAndLogin(
      outsiderAgent,
      `outsider-${stamp}@coreknot-test.local`,
      'Outsider'
    );

    await User.findByIdAndUpdate(teamMemberId, { departmentId: salesDept._id });
    await User.findByIdAndUpdate(outsiderId, { departmentId: salesDept._id });

    artist = await Artist.create({
      name: 'Test Artist',
      team: [teamMemberId],
    });
  });

  it('allows claimed team member read/write on OS, calendar, analytics, inquiries, gigs', async () => {
    const overview = await teamAgent.get(`/api/artists/${artist._id}/os/overview`);
    expect(overview.statusCode).toBe(200);
    expect(overview.body).toHaveProperty('revenueMtd');

    const inquiries = await teamAgent.get(`/api/artists/${artist._id}/os/inquiries`);
    expect(inquiries.statusCode).toBe(200);
    expect(Array.isArray(inquiries.body)).toBe(true);

    const created = await teamAgent.post(`/api/artists/${artist._id}/os/inquiries`).send({
      clientName: 'Test Client',
      eventName: 'Wedding',
    });
    expect(created.statusCode).toBe(201);
    expect(created.body.clientName).toBe('Test Client');

    const patchedInquiry = await teamAgent
      .patch(`/api/artists/${artist._id}/os/inquiries/${created.body._id}`)
      .send({ status: 'contacted' });
    expect(patchedInquiry.statusCode).toBe(200);
    expect(patchedInquiry.body.status).toBe('contacted');

    const calendar = await teamAgent.get(`/api/artists/${artist._id}/os/calendar`);
    expect(calendar.statusCode).toBe(200);
    expect(Array.isArray(calendar.body)).toBe(true);

    const startAt = new Date();
    const calendarEvent = await teamAgent.post(`/api/artists/${artist._id}/os/calendar`).send({
      title: 'Studio Session',
      startAt: startAt.toISOString(),
      eventType: 'personal',
    });
    expect(calendarEvent.statusCode).toBe(201);
    expect(calendarEvent.body.title).toBe('Studio Session');

    const analyticsScores = await teamAgent.get(`/api/artists/${artist._id}/os/analytics/scores`);
    expect(analyticsScores.statusCode).toBe(200);
    expect(analyticsScores.body).toHaveProperty('scores');
    expect(analyticsScores.body.scores).toHaveProperty('audienceScore');

    const platformAnalytics = await teamAgent.get(`/api/artists/${artist._id}/analytics/spotify`);
    expect(platformAnalytics.statusCode).toBe(200);
    expect(platformAnalytics.body).toHaveProperty('history');
    expect(platformAnalytics.body.artist._id).toBe(String(artist._id));

    const gig = await ArtistGig.create({
      artistId: artist._id,
      name: 'Launch Gig',
      gigDate: new Date(),
    });

    const patched = await teamAgent.patch(`/api/artists/${artist._id}/os/gigs/${gig._id}`).send({
      location: 'Mumbai',
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.body.location).toBe('Mumbai');
  });

  it('returns 403 for non-team user on OS, calendar, analytics, inquiries, gigs', async () => {
    const overview = await outsiderAgent.get(`/api/artists/${artist._id}/os/overview`);
    expect(overview.statusCode).toBe(403);
    expect(overview.body.error).toMatch(/team membership/i);

    const inquiries = await outsiderAgent.get(`/api/artists/${artist._id}/os/inquiries`);
    expect(inquiries.statusCode).toBe(403);

    const created = await outsiderAgent.post(`/api/artists/${artist._id}/os/inquiries`).send({
      clientName: 'Blocked',
    });
    expect(created.statusCode).toBe(403);

    const teamCreated = await teamAgent.post(`/api/artists/${artist._id}/os/inquiries`).send({
      clientName: 'Team Inquiry',
      eventName: 'Corporate',
    });
    expect(teamCreated.statusCode).toBe(201);

    const patchedInquiry = await outsiderAgent
      .patch(`/api/artists/${artist._id}/os/inquiries/${teamCreated.body._id}`)
      .send({ status: 'contacted' });
    expect(patchedInquiry.statusCode).toBe(403);

    const calendar = await outsiderAgent.get(`/api/artists/${artist._id}/os/calendar`);
    expect(calendar.statusCode).toBe(403);

    const calendarEvent = await outsiderAgent.post(`/api/artists/${artist._id}/os/calendar`).send({
      title: 'Blocked Event',
      startAt: new Date().toISOString(),
    });
    expect(calendarEvent.statusCode).toBe(403);

    const analyticsScores = await outsiderAgent.get(`/api/artists/${artist._id}/os/analytics/scores`);
    expect(analyticsScores.statusCode).toBe(403);

    const platformAnalytics = await outsiderAgent.get(`/api/artists/${artist._id}/analytics/spotify`);
    expect(platformAnalytics.statusCode).toBe(403);

    const gig = await ArtistGig.create({
      artistId: artist._id,
      name: 'Blocked Gig',
      gigDate: new Date(),
    });

    const patched = await outsiderAgent.patch(`/api/artists/${artist._id}/os/gigs/${gig._id}`).send({
      location: 'Nowhere',
    });
    expect(patched.statusCode).toBe(403);
  });
});
