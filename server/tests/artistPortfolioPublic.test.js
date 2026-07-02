const request = require('supertest');
const app = require('../server');
const Artist = require('../models/Artist');
const ArtistMetrics = require('../models/ArtistMetrics');
const User = require('../models/User');
const Department = require('../models/Department');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { mintSessionAgent } = require('./helpers/mintTestSession');
const { PRESET_PAGES } = require('../utils/pagePermissions');

async function ensureArtistManagementDept() {
  let dept = await Department.findOne({ slug: 'artist-management' });
  if (!dept) {
    dept = await Department.create({
      name: 'Artist Management',
      slug: 'artist-management',
      permissionPreset: 'artist-management',
      pagePermissions: PRESET_PAGES['artist-management'],
    });
  }
  return dept;
}

async function loginArtistManager(agent) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `portfolio-${stamp}@coreknot-test.local`;
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Portfolio Manager', email, password: DEV_DEFAULT_PASSWORD, gender: 'male' });
  expect(reg.statusCode).toBe(201);

  const dept = await ensureArtistManagementDept();
  await User.findByIdAndUpdate(reg.body._id, { departmentId: dept._id });
  await mintSessionAgent(agent, reg.body._id);
  return reg.body._id;
}

describe('Artist portfolio summary and public profile', () => {
  it('GET /api/artists/portfolio/summary aggregates enriched roster metrics', async () => {
    const agent = request.agent(app);
    await loginArtistManager(agent);

    const stamp = Date.now();
    const a1 = await Artist.create({ name: 'Portfolio Artist One', slug: `pa-one-${stamp}` });
    const a2 = await Artist.create({ name: 'Portfolio Artist Two', slug: `pa-two-${stamp}` });

    await ArtistMetrics.create({
      artistId: a1._id,
      analytics: {
        spotify: { followers: 1000 },
        youtube: { subscribers: 500 },
      },
      analyticsHistory: [],
    });
    await ArtistMetrics.create({
      artistId: a2._id,
      analytics: {
        instagram: { followers: 2000 },
      },
      analyticsHistory: [],
    });

    const res = await agent.get('/api/artists/portfolio/summary');
    expect(res.statusCode).toBe(200);
    expect(res.body.totalArtists).toBeGreaterThanOrEqual(2);
    expect(res.body.totalReach).toBeGreaterThanOrEqual(3500);
    expect(res.body.totalFollowers).toBeGreaterThanOrEqual(3500);
    expect(res.body).toHaveProperty('monthlyGrowth');
    expect(res.body).toHaveProperty('totalStreams');
    expect(res.body).toHaveProperty('totalRevenueMtd');
    expect(res.body).toHaveProperty('totalBookings');
    expect(res.body).toHaveProperty('topPerformer');
    expect(res.body.rankings).toBeDefined();
    expect(Array.isArray(res.body.rankings.topGrowth)).toBe(true);
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });

  it('GET /api/artists/public/:slug returns sanitized public fields without auth', async () => {
    const stamp = Date.now();
    const slug = `public-artist-${stamp}`;
    const gigDate = new Date();
    gigDate.setUTCDate(gigDate.getUTCDate() + 30);
    const gigDateIso = gigDate.toISOString().slice(0, 10);
    await Artist.create({
      name: 'Public Test Artist',
      slug,
      bio: 'Public bio only',
      website: 'https://example.com',
      socials: { instagram: 'https://instagram.com/test' },
      events: [{ title: 'Summer Fest', venue: 'Mumbai', date: gigDateIso, status: 'planned' }],
    });

    const res = await request(app).get(`/api/artists/public/${slug}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('Public Test Artist');
    expect(res.body.bio).toBe('Public bio only');
    expect(res.body.socialLinks).toBeDefined();
    expect(res.body.upcomingGigs).toHaveLength(1);
    expect(res.body.upcomingGigs[0]).toEqual(
      expect.objectContaining({ venue: 'Mumbai', date: gigDateIso }),
    );
    expect(res.body.upcomingGigs[0].title).toBeUndefined();
    expect(res.body).toHaveProperty('musicLinks');
    expect(res.body.oauthCredentials).toBeUndefined();
    expect(res.body.team).toBeUndefined();
  });

  it('POST /api/artists/public/:slug/inquiry creates ArtistInquiry', async () => {
    const stamp = Date.now();
    const slug = `booking-artist-${stamp}`;
    await Artist.create({ name: 'Booking Artist', slug });

    const res = await request(app).post(`/api/artists/public/${slug}/inquiry`).send({
      clientName: 'Event Planner',
      email: 'planner@example.com',
      eventName: 'Corporate Gig',
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.inquiryId).toBeDefined();
    expect(res.body.message).toMatch(/inquiry/i);

    const missingContact = await request(app).post(`/api/artists/public/${slug}/inquiry`).send({
      clientName: 'No Contact',
    });
    expect(missingContact.statusCode).toBe(400);
    expect(missingContact.body.message).toMatch(/email or phone/i);
  });

  it('GET /api/artists/:id/os/assets returns list for team member', async () => {
    const agent = request.agent(app);
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const teamMemberId = await loginArtistManager(agent);

    const artist = await Artist.create({
      name: 'Assets Artist',
      team: [teamMemberId],
    });

    const res = await agent.get(`/api/artists/${artist._id}/os/assets`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
