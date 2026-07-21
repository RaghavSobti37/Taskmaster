const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Department = require('../models/Department');
const Artist = require('../models/Artist');
const ArtistMembership = require('../models/ArtistMembership');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { mintSessionAgent } = require('./helpers/mintTestSession');
const { PRESET_PAGES } = require('../utils/pagePermissions');
const { generateShareToken } = require('../domains/artists/controllers/artistShareController');
const { createArtistMembership } = require('../domains/artists/services/artistMembershipService');

// Mock mailDriver so invite email dispatch doesn't fail or attempt real HTTP calls
jest.mock('../services/mailDriver', () => ({
  sendMail: jest.fn().mockResolvedValue({ success: true }),
  dispatchEmailPayload: jest.fn().mockResolvedValue({ success: true }),
  resolveAutoMailerApiBase: jest.fn().mockReturnValue('https://mailer-api.example.com'),
  validateAutoMailerApiBase: jest.fn().mockReturnValue(true),
  assertEmailDispatchSucceeded: jest.fn().mockImplementation((result) => {
    if (!result || result.error) throw new Error(result?.error || 'Email dispatch failed');
    return result;
  }),
  limits: { maxPayloadSize: 100_000 },
}));

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
  await mintSessionAgent(agent, reg.body._id);
  return reg.body._id;
}

describe('ArtistMembership', () => {
  let artist;
  let ownerAgent;
  let memberAgent;
  let outsiderAgent;
  let ownerId;
  let memberId;

  beforeEach(async () => {
    const salesDept = await ensureSalesDept();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    ownerAgent = request.agent(app);
    memberAgent = request.agent(app);
    outsiderAgent = request.agent(app);

    ownerId = await registerAndLogin(
      ownerAgent,
      `owner-${stamp}@coreknot-test.local`,
      'Owner',
    );
    memberId = await registerAndLogin(
      memberAgent,
      `member-${stamp}@coreknot-test.local`,
      'Member',
    );
    await registerAndLogin(
      outsiderAgent,
      `outsider-${stamp}@coreknot-test.local`,
      'Outsider',
    );

    await User.findByIdAndUpdate(ownerId, { departmentId: salesDept._id });
    await User.findByIdAndUpdate(memberId, { departmentId: salesDept._id });

    artist = await Artist.create({
      name: 'Membership Test Artist',
      team: [],
    });
  });

  it('claim creates ArtistMembership with artist-owner role', async () => {
    const token = generateShareToken(artist._id);

    const claim = await ownerAgent.post(`/api/artists/${artist._id}/claim`).send({ token });
    expect(claim.statusCode).toBe(200);
    expect(claim.body.success).toBe(true);
    expect(claim.body.redirectUrl).toBe(`/artist-workspace/${artist._id}`);
    expect(claim.body.membership).toMatchObject({
      role: 'artist-owner',
      artistId: String(artist._id),
      status: 'accepted',
    });
    expect(claim.body.membership.acceptedAt).toBeTruthy();

    const doc = await ArtistMembership.findOne({ artistId: artist._id, userId: ownerId });
    expect(doc).toBeTruthy();
    expect(doc.role).toBe('artist-owner');
    expect(doc.status).toBe('accepted');

    const refreshed = await Artist.findById(artist._id);
    expect(refreshed.team.map(String)).toContain(String(ownerId));
  });

  it('invite creates pending membership for existing user', async () => {
    await createArtistMembership({
      artistId: artist._id,
      userId: ownerId,
      role: 'artist-owner',
      invitedBy: ownerId,
      acceptedAt: new Date(),
      status: 'accepted',
    });
    await Artist.findByIdAndUpdate(artist._id, { $push: { team: ownerId } });

    const memberUser = await User.findById(memberId);
    const invite = await ownerAgent
      .post(`/api/artists/${artist._id}/members/invite`)
      .send({ email: memberUser.email, role: 'artist-assistant' });

    expect(invite.statusCode).toBe(201);
    expect(invite.body.status).toBe('pending');
    expect(invite.body.role).toBe('artist-assistant');
  });

  it('allows accepted member to access /os/overview', async () => {
    await createArtistMembership({
      artistId: artist._id,
      userId: memberId,
      role: 'artist-assistant',
      invitedBy: ownerId,
      acceptedAt: new Date(),
      status: 'accepted',
    });
    await Artist.findByIdAndUpdate(artist._id, { $push: { team: memberId } });

    const overview = await memberAgent.get(`/api/artists/${artist._id}/os/overview`);
    expect(overview.statusCode).toBe(200);
    expect(overview.body).toHaveProperty('revenueMtd');
  });

  it('returns 403 for outsider on /os/overview', async () => {
    const overview = await outsiderAgent.get(`/api/artists/${artist._id}/os/overview`);
    expect(overview.statusCode).toBe(403);
    expect(overview.body.error).toMatch(/team membership|workspace access/i);
  });

  it('gates finance endpoints by finance permission', async () => {
    await createArtistMembership({
      artistId: artist._id,
      userId: memberId,
      role: 'artist-assistant',
      invitedBy: ownerId,
      acceptedAt: new Date(),
      status: 'accepted',
    });
    await Artist.findByIdAndUpdate(artist._id, { $push: { team: memberId } });

    const blocked = await memberAgent.get(`/api/artists/${artist._id}/os/finance`);
    expect(blocked.statusCode).toBe(403);

    await createArtistMembership({
      artistId: artist._id,
      userId: ownerId,
      role: 'artist-owner',
      invitedBy: ownerId,
      acceptedAt: new Date(),
      status: 'accepted',
    });
    await Artist.findByIdAndUpdate(artist._id, { $push: { team: ownerId } });

    const allowed = await ownerAgent.get(`/api/artists/${artist._id}/os/finance`);
    expect(allowed.statusCode).toBe(200);
    expect(allowed.body).toBeTruthy();
  });

  it('returns current user membership via /membership/me', async () => {
    await createArtistMembership({
      artistId: artist._id,
      userId: memberId,
      role: 'artist-publicist',
      invitedBy: ownerId,
      acceptedAt: new Date(),
      status: 'accepted',
    });
    await Artist.findByIdAndUpdate(artist._id, { $push: { team: memberId } });

    const me = await memberAgent.get(`/api/artists/${artist._id}/membership/me`);
    expect(me.statusCode).toBe(200);
    expect(me.body.role).toBe('artist-publicist');
    expect(me.body.permissions.content).toBe(true);
    expect(me.body.permissions.socials).toBe(true);
    expect(me.body.permissions.finance).toBe(false);
  });

  it('cannot remove sole artist owner', async () => {
    const membership = await createArtistMembership({
      artistId: artist._id,
      userId: ownerId,
      role: 'artist-owner',
      invitedBy: ownerId,
      acceptedAt: new Date(),
      status: 'accepted',
    });
    await Artist.findByIdAndUpdate(artist._id, { $push: { team: ownerId } });

    const res = await ownerAgent.delete(`/api/artists/${artist._id}/members/${membership._id}`);
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/sole artist owner/i);
  });
});
