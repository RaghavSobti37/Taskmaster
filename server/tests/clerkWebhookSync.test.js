const crypto = require('crypto');
const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const TenantInvite = require('../models/TenantInvite');
const ClerkSyncEvent = require('../models/ClerkSyncEvent');
const {
  handleOrganizationCreated,
  handleOrganizationMembershipCreated,
  handleOrganizationInvitationCreated,
  handleOrganizationInvitationAccepted,
  handleOrganizationInvitationRevoked,
  clerkInviteTokenHash,
} = require('../domains/auth/webhooks/clerkWebhookHandler');

const TEST_WEBHOOK_SECRET = 'whsec_dGVzdC1zZWNyZXQta2V5MTIzNDU2';

const signSvixPayload = (payload, secret = TEST_WEBHOOK_SECRET) => {
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const secretPart = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  const secretBytes = Buffer.from(secretPart, 'base64');
  const toSign = `${msgId}.${timestamp}.${payloadStr}`;
  const signature = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');

  return {
    payloadStr,
    headers: {
      'svix-id': msgId,
      'svix-timestamp': String(timestamp),
      'svix-signature': `v1,${signature}`,
    },
  };
};

describe('clerkWebhook sync', () => {
  const prevSecret = process.env.CLERK_WEBHOOK_SECRET;

  beforeAll(() => {
    process.env.CLERK_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  });

  afterAll(() => {
    if (prevSecret === undefined) delete process.env.CLERK_WEBHOOK_SECRET;
    else process.env.CLERK_WEBHOOK_SECRET = prevSecret;
  });

  it('rejects webhook requests with invalid signature', async () => {
    const body = { type: 'organization.created', data: { id: 'org_bad', name: 'Bad Org' } };
    const res = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .set('svix-id', 'msg_invalid')
      .set('svix-timestamp', String(Math.floor(Date.now() / 1000)))
      .set('svix-signature', 'v1,invalidsignature')
      .send(body);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('accepts signed webhook and dedupes duplicate svix-id', async () => {
    const event = {
      type: 'organization.created',
      data: {
        id: 'org_dup_test',
        name: 'Dup Org',
        slug: 'dup-org',
      },
    };
    const { payloadStr, headers } = signSvixPayload(event);

    const first = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .set(headers)
      .send(payloadStr);

    expect(first.statusCode).toBe(200);
    expect(first.body.action).toBe('created');

    const second = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .set(headers)
      .send(payloadStr);

    expect(second.statusCode).toBe(200);
    expect(second.body.action).toBe('duplicate');

    const syncRow = await ClerkSyncEvent.findOne({ clerkEventId: headers['svix-id'] })
      .setOptions({ bypassTenant: true });
    expect(syncRow?.success).toBe(true);
    expect(await Tenant.countDocuments({ clerkOrganizationId: 'org_dup_test' })).toBe(1);
  });

  it('handleOrganizationCreated upserts Tenant from Clerk org', async () => {
    const result = await handleOrganizationCreated({
      data: {
        id: 'org_acme_1',
        name: 'Acme Corp',
        slug: 'acme-corp',
      },
    });

    expect(result.action).toBe('created');
    const tenant = await Tenant.findOne({ clerkOrganizationId: 'org_acme_1' })
      .setOptions({ bypassTenant: true });
    expect(tenant).toBeTruthy();
    expect(tenant.name).toBe('Acme Corp');
    expect(tenant.slug).toBe('acme-corp');
    expect(tenant.contactEmail).toContain('@');
  });

  it('handleOrganizationMembershipCreated upserts TenantMembership', async () => {
    const user = await User.create({
      name: 'Member User',
      email: 'member-sync@coreknot-test.local',
      clerkId: 'user_member_sync',
      password: 'x'.repeat(32),
    });
    const tenant = await Tenant.create({
      name: 'Member Org',
      slug: 'member-org',
      clerkOrganizationId: 'org_member_sync',
      contactEmail: 'owner@coreknot-test.local',
      status: 'active',
    });

    const result = await handleOrganizationMembershipCreated({
      data: {
        organization: { id: 'org_member_sync' },
        public_user_data: { user_id: 'user_member_sync' },
        role: 'org:admin',
      },
    });

    expect(result.action).toBe('upserted');
    const membership = await TenantMembership.findOne({
      tenantId: tenant._id,
      userId: user._id,
    }).setOptions({ bypassTenant: true });
    expect(membership).toBeTruthy();
    expect(membership.role).toBe('admin');
    expect(membership.status).toBe('active');
  });

  it('handleOrganizationInvitationCreated projects TenantInvite cache', async () => {
    const tenant = await Tenant.create({
      name: 'Invite Projection Org',
      slug: 'invite-projection-org',
      clerkOrganizationId: 'org_invite_proj',
      contactEmail: 'owner@coreknot-test.local',
      status: 'active',
    });

    const result = await handleOrganizationInvitationCreated({
      data: {
        id: 'orginv_proj_1',
        organization_id: 'org_invite_proj',
        email_address: 'invitee@coreknot-test.local',
        role: 'org:member',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    expect(result.action).toBe('upserted');
    const invite = await TenantInvite.findOne({
      tokenHash: clerkInviteTokenHash('orginv_proj_1'),
    }).setOptions({ bypassTenant: true });
    expect(invite).toBeTruthy();
    expect(String(invite.tenantId)).toBe(String(tenant._id));
    expect(invite.email).toBe('invitee@coreknot-test.local');
    expect(invite.status).toBe('pending');
  });

  it('handleOrganizationInvitationAccepted marks invite accepted and upserts membership', async () => {
    const user = await User.create({
      name: 'Accepted Invitee',
      email: 'accepted@coreknot-test.local',
      clerkId: 'user_accepted_inv',
      password: 'x'.repeat(32),
    });
    const tenant = await Tenant.create({
      name: 'Accepted Invite Org',
      slug: 'accepted-invite-org',
      clerkOrganizationId: 'org_accepted_inv',
      contactEmail: 'owner@coreknot-test.local',
      status: 'active',
    });

    const result = await handleOrganizationInvitationAccepted({
      data: {
        id: 'orginv_accepted_1',
        organization_id: 'org_accepted_inv',
        email_address: 'accepted@coreknot-test.local',
        role: 'org:admin',
        public_user_data: { user_id: 'user_accepted_inv' },
      },
    });

    expect(result.action).toBe('upserted');
    const invite = await TenantInvite.findOne({
      tokenHash: clerkInviteTokenHash('orginv_accepted_1'),
    }).setOptions({ bypassTenant: true });
    expect(invite.status).toBe('accepted');

    const membership = await TenantMembership.findOne({
      tenantId: tenant._id,
      userId: user._id,
    }).setOptions({ bypassTenant: true });
    expect(membership.role).toBe('admin');
    expect(membership.status).toBe('active');
  });

  it('handleOrganizationInvitationRevoked marks invite revoked', async () => {
    await Tenant.create({
      name: 'Revoked Invite Org',
      slug: 'revoked-invite-org',
      clerkOrganizationId: 'org_revoked_inv',
      contactEmail: 'owner@coreknot-test.local',
      status: 'active',
    });

    await handleOrganizationInvitationCreated({
      data: {
        id: 'orginv_revoke_1',
        organization_id: 'org_revoked_inv',
        email_address: 'revoked@coreknot-test.local',
        role: 'org:member',
      },
    });

    const result = await handleOrganizationInvitationRevoked({
      data: {
        id: 'orginv_revoke_1',
        organization_id: 'org_revoked_inv',
        email_address: 'revoked@coreknot-test.local',
        role: 'org:member',
      },
    });

    expect(result.action).toBe('upserted');
    const invite = await TenantInvite.findOne({
      tokenHash: clerkInviteTokenHash('orginv_revoke_1'),
    }).setOptions({ bypassTenant: true });
    expect(invite.status).toBe('revoked');
  });
});
