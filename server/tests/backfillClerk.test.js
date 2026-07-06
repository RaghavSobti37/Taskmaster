jest.mock('@clerk/clerk-sdk-node', () => ({
  clerkClient: {
    organizations: {
      createOrganization: jest.fn(),
      createOrganizationMembership: jest.fn(),
    },
  },
}));

jest.mock('../utils/clerkAuth', () => ({
  isClerkConfigured: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { clerkClient } = require('@clerk/clerk-sdk-node');
const { isClerkConfigured } = require('../utils/clerkAuth');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const User = require('../models/User');
const {
  backfillClerkOrganizations,
  backfillClerkMemberships,
  inventoryClerkSync,
} = require('../services/clerkBackfillService');

describe('clerkBackfillService', () => {
  let owner;
  let member;
  let tenantMissingOrg;

  beforeEach(async () => {
    jest.clearAllMocks();
    isClerkConfigured.mockReturnValue(true);

    owner = await User.create({
      name: 'Owner User',
      email: `owner-${Date.now()}@example.com`,
      clerkId: 'user_owner_backfill',
    });
    member = await User.create({
      name: 'Member User',
      email: `member-${Date.now()}@example.com`,
      clerkId: 'user_member_backfill',
    });

    tenantMissingOrg = await Tenant.create({
      name: 'Backfill Org',
      slug: `backfill-${Date.now().toString(36)}`,
      contactEmail: owner.email,
      ownerId: owner._id,
    });

    await TenantMembership.create({
      tenantId: tenantMissingOrg._id,
      userId: owner._id,
      role: 'admin',
      status: 'active',
    });

    clerkClient.organizations.createOrganization.mockResolvedValue({ id: 'org_backfill_new' });
    clerkClient.organizations.createOrganizationMembership.mockResolvedValue({});
  });

  describe('inventoryClerkSync', () => {
    it('reports tenants missing clerkOrganizationId and membership gaps', async () => {
      const report = await inventoryClerkSync();
      expect(report.tenantsMissingClerkOrganizationId).toBeGreaterThanOrEqual(1);
      expect(report.activeMemberships).toBeGreaterThanOrEqual(1);
      expect(report.membershipGaps.tenantMissingClerkOrg).toBeGreaterThanOrEqual(1);
    });
  });

  describe('backfillClerkOrganizations', () => {
    it('dry-run lists would_create without Clerk API calls', async () => {
      const result = await backfillClerkOrganizations({ dryRun: true });
      expect(clerkClient.organizations.createOrganization).not.toHaveBeenCalled();
      const row = result.rows.find((r) => r.tenantId === String(tenantMissingOrg._id));
      expect(row).toMatchObject({
        action: 'would_create',
        creatorClerkId: 'user_owner_backfill',
      });
    });

    it('execute creates Clerk org and persists clerkOrganizationId', async () => {
      const result = await backfillClerkOrganizations({ dryRun: false });
      expect(clerkClient.organizations.createOrganization).toHaveBeenCalled();
      const row = result.rows.find((r) => r.tenantId === String(tenantMissingOrg._id));
      expect(row).toMatchObject({
        action: 'created',
        clerkOrganizationId: 'org_backfill_new',
      });

      const updated = await Tenant.findById(tenantMissingOrg._id).setOptions({ bypassTenant: true });
      expect(updated.clerkOrganizationId).toBe('org_backfill_new');
    });
  });

  describe('backfillClerkMemberships', () => {
    beforeEach(async () => {
      tenantMissingOrg.clerkOrganizationId = 'org_membership_backfill';
      await tenantMissingOrg.save();
      await TenantMembership.create({
        tenantId: tenantMissingOrg._id,
        userId: member._id,
        role: 'member',
        status: 'active',
      });
    });

    it('dry-run maps member role to org:member', async () => {
      const result = await backfillClerkMemberships({ dryRun: true });
      expect(clerkClient.organizations.createOrganizationMembership).not.toHaveBeenCalled();
      const row = result.rows.find(
        (r) => r.userId === String(member._id) && r.action === 'would_create',
      );
      expect(row).toMatchObject({
        clerkRole: 'org:member',
        clerkOrganizationId: 'org_membership_backfill',
      });
    });

    it('execute creates membership and skips already-member errors', async () => {
      clerkClient.organizations.createOrganizationMembership
        .mockRejectedValueOnce(new Error('User is already a member'))
        .mockResolvedValueOnce({});

      const result = await backfillClerkMemberships({ dryRun: false });
      expect(result.created + result.skipped).toBeGreaterThanOrEqual(2);
      expect(clerkClient.organizations.createOrganizationMembership).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org_membership_backfill',
          userId: 'user_member_backfill',
          role: 'org:member',
        }),
      );
    });

    it('maps admin membership to org:admin on execute', async () => {
      const result = await backfillClerkMemberships({ dryRun: false });
      expect(clerkClient.organizations.createOrganizationMembership).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_owner_backfill',
          role: 'org:admin',
        }),
      );
      expect(result.failed).toBe(0);
    });
  });
});
