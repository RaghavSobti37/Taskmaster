const Tenant = require('../models/Tenant');
const Project = require('../domains/projects/models/Project');
const { markOnboardingStepComplete, handleProjectCreated } = require('../services/onboardingListener');

describe('onboardingListener', () => {
  const stamp = Date.now();

  afterEach(async () => {
    await Tenant.deleteMany({ slug: new RegExp(`^onboarding-listener-${stamp}`) });
  });

  it('marks profile_complete idempotently', async () => {
    const tenant = await Tenant.create({
      name: `Listener ${stamp}`,
      slug: `onboarding-listener-${stamp}`,
      contactEmail: `listener-${stamp}@coreknot-test.local`,
      plan: 'free',
      onboardingProgress: { completedSteps: [], dismissedChecklist: false },
    });

    await markOnboardingStepComplete(tenant._id, 'profile_complete');
    const once = await Tenant.findById(tenant._id).setOptions({ bypassTenant: true }).lean();
    expect(once.onboardingProgress.completedSteps).toEqual(['profile_complete']);

    await markOnboardingStepComplete(tenant._id, 'profile_complete');
    const twice = await Tenant.findById(tenant._id).setOptions({ bypassTenant: true }).lean();
    expect(twice.onboardingProgress.completedSteps).toEqual(['profile_complete']);
  });

  it('marks first_project when project exists for tenant', async () => {
    const tenant = await Tenant.create({
      name: `Listener Project ${stamp}`,
      slug: `onboarding-listener-project-${stamp}`,
      contactEmail: `listener-project-${stamp}@coreknot-test.local`,
      plan: 'free',
      onboardingProgress: { completedSteps: [], dismissedChecklist: false },
    });

    jest.spyOn(Project, 'countDocuments').mockReturnValue({
      setOptions: () => Promise.resolve(1),
    });

    await handleProjectCreated({ tenantId: tenant._id });
    const updated = await Tenant.findById(tenant._id).setOptions({ bypassTenant: true }).lean();
    expect(updated.onboardingProgress.completedSteps).toContain('first_project');

    Project.countDocuments.mockRestore();
  });
});
