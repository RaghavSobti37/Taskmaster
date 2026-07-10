const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Project = require('../domains/projects/models/Project');
const { markOnboardingStepComplete, handleProjectCreated, handleProfileUpdated } = require('../services/onboardingListener');

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

  it('marks profile_complete when user has phone and dob', async () => {
    const tenant = await Tenant.create({
      name: `Listener Profile ${stamp}`,
      slug: `onboarding-listener-profile-${stamp}`,
      contactEmail: `listener-profile-${stamp}@coreknot-test.local`,
      plan: 'free',
      onboardingProgress: { completedSteps: [], dismissedChecklist: false },
    });
    const user = await User.create({
      name: 'Complete Profile User',
      email: `listener-profile-user-${stamp}@coreknot-test.local`,
      password: 'TestPassword123!',
      gender: 'male',
      phone: '9876543210',
      dateOfBirth: new Date('1990-01-01'),
      tenantId: tenant._id,
    });

    await handleProfileUpdated({ user, tenantId: tenant._id });
    const updated = await Tenant.findById(tenant._id).setOptions({ bypassTenant: true }).lean();
    expect(updated.onboardingProgress.completedSteps).toContain('profile_complete');

    await User.deleteOne({ _id: user._id });
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
