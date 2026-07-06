const Tenant = require('../models/Tenant');
const Project = require('../domains/projects/models/Project');
const { getProfileCompletionIssues } = require('../utils/profileCompleteness');
const { emitOnboardingEvent, onOnboardingEvent } = require('./onboardingEvents');
const { defaultOnboardingProgress } = require('./onboardingChecklistService');

async function markOnboardingStepComplete(tenantId, stepId) {
  if (!tenantId || !stepId) return null;
  const tenant = await Tenant.findById(tenantId).setOptions({ bypassTenant: true });
  if (!tenant) return null;
  if (!tenant.onboardingProgress) tenant.onboardingProgress = defaultOnboardingProgress();
  const completed = tenant.onboardingProgress.completedSteps || [];
  if (completed.includes(stepId)) return tenant;
  tenant.onboardingProgress.completedSteps = [...completed, stepId];
  tenant.updatedAt = new Date();
  await tenant.save();
  return tenant;
}

async function handleProfileUpdated({ user, tenantId }) {
  const tid = tenantId || user?.activeTenantId || user?.tenantId;
  if (!tid || !user) return;
  const issues = getProfileCompletionIssues(user);
  if (issues.length > 0) return;
  await markOnboardingStepComplete(tid, 'profile_complete');
}

async function handleProjectCreated({ tenantId }) {
  if (!tenantId) return;
  const count = await Project.countDocuments({ tenantId }).setOptions({ bypassTenant: true });
  if (count < 1) return;
  await markOnboardingStepComplete(tenantId, 'first_project');
}

async function handleInviteSent({ tenantId }) {
  if (!tenantId) return;
  await markOnboardingStepComplete(tenantId, 'invite_teammate');
}

function registerOnboardingListeners() {
  onOnboardingEvent('profile.updated', (payload) => {
    handleProfileUpdated(payload).catch(() => {});
  });
  onOnboardingEvent('project.created', (payload) => {
    handleProjectCreated(payload).catch(() => {});
  });
  onOnboardingEvent('invite.sent', (payload) => {
    handleInviteSent(payload).catch(() => {});
  });
}

registerOnboardingListeners();

module.exports = {
  markOnboardingStepComplete,
  handleProfileUpdated,
  handleProjectCreated,
  handleInviteSent,
  registerOnboardingListeners,
};
