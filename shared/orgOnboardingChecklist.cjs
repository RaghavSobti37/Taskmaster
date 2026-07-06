/** CJS entry for Node server — keep in sync with orgOnboardingChecklist.js */

const SOLO_TEAM_SIZE_VALUES = new Set(['1', 'just-me', 'solo', 'only-me']);

const BASE_ONBOARDING_CHECKLIST_STEPS = [
  {
    id: 'profile_complete',
    label: 'Complete your profile',
    path: '/settings/profile',
    why: 'A complete profile helps teammates recognize you and unlocks account security.',
    tier: 'all',
  },
  {
    id: 'first_project',
    label: 'Create your first project',
    path: '/projects',
    why: 'Projects organize work — completing this unlocks Finance for your organization.',
    tier: 'all',
  },
  {
    id: 'invite_teammate',
    label: 'Invite a teammate',
    path: '/admin/users',
    why: 'Shared task assignment and team dashboards need at least one collaborator.',
    tier: 'all',
    hideWhenSolo: true,
  },
];

const ENTERPRISE_ONBOARDING_CHECKLIST_STEPS = [
  {
    id: 'configure_sso',
    label: 'Configure SSO',
    path: '/admin/tenant-sso',
    why: 'Single sign-on keeps enterprise access centralized and auditable.',
    tier: 'enterprise',
  },
  {
    id: 'verify_domain',
    label: 'Verify your domain',
    path: '/admin/platform-settings',
    why: 'Domain verification enables branded email and secure auto-join rules.',
    tier: 'enterprise',
  },
];

function isSoloTeamSize(teamSize) {
  const normalized = String(teamSize || '').trim().toLowerCase();
  return SOLO_TEAM_SIZE_VALUES.has(normalized);
}

function isStepApplicable(step, tenant) {
  if (!step || !tenant) return false;
  if (step.hideWhenSolo && isSoloTeamSize(tenant.teamSize)) return false;
  if (step.tier === 'enterprise' && tenant.plan !== 'enterprise') return false;
  return true;
}

function getApplicableOnboardingSteps(tenant) {
  const catalog = [...BASE_ONBOARDING_CHECKLIST_STEPS, ...ENTERPRISE_ONBOARDING_CHECKLIST_STEPS];
  return catalog
    .filter((step) => isStepApplicable(step, tenant))
    .map(({ id, label, path, why }) => ({ id, label, path, why }));
}

const CHECKLIST_SNOOZE_MS = 24 * 60 * 60 * 1000;

/** @deprecated use getApplicableOnboardingSteps(tenant) */
const ONBOARDING_CHECKLIST_STEPS = BASE_ONBOARDING_CHECKLIST_STEPS.map(({ id, label, path, why }) => ({
  id,
  label,
  path,
  why,
}));

module.exports = {
  BASE_ONBOARDING_CHECKLIST_STEPS,
  ENTERPRISE_ONBOARDING_CHECKLIST_STEPS,
  ONBOARDING_CHECKLIST_STEPS,
  CHECKLIST_SNOOZE_MS,
  SOLO_TEAM_SIZE_VALUES,
  isSoloTeamSize,
  isStepApplicable,
  getApplicableOnboardingSteps,
};
