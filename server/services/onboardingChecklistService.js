const {
  CHECKLIST_SNOOZE_MS,
  getApplicableOnboardingSteps,
} = require('../../shared/orgOnboardingChecklist.cjs');

function defaultOnboardingProgress() {
  return { completedSteps: [], dismissedChecklist: false, checklistSnoozedUntil: null };
}

function isChecklistComplete(progress, steps) {
  if (!steps?.length) return true;
  const completed = new Set(progress?.completedSteps || []);
  return steps.every((step) => completed.has(step.id));
}

function isChecklistSnoozed(progress, now = new Date()) {
  const until = progress?.checklistSnoozedUntil;
  if (!until) return false;
  return new Date(until) > now;
}

function isChecklistVisible(progress, steps, now = new Date()) {
  if (!steps?.length) return false;
  if (isChecklistComplete(progress, steps)) return false;
  if (isChecklistSnoozed(progress, now)) return false;
  return true;
}

function snoozeChecklist(progress, now = new Date()) {
  const next = { ...defaultOnboardingProgress(), ...progress };
  next.checklistSnoozedUntil = new Date(now.getTime() + CHECKLIST_SNOOZE_MS);
  return next;
}

function serializeOnboardingProgress(progress) {
  const base = { ...defaultOnboardingProgress(), ...(progress || {}) };
  if (base.checklistSnoozedUntil) {
    base.checklistSnoozedUntil = new Date(base.checklistSnoozedUntil).toISOString();
  } else {
    base.checklistSnoozedUntil = null;
  }
  return base;
}

function buildOnboardingProgressStats(progress, steps) {
  const completedSet = new Set(progress?.completedSteps || []);
  const completedCount = steps.filter((s) => completedSet.has(s.id)).length;
  const totalCount = steps.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;
  return { completedCount, totalCount, percent };
}

function buildOnboardingChecklistPayload(progress, tenant = null, now = new Date()) {
  const checklistSteps = tenant ? getApplicableOnboardingSteps(tenant) : [];
  const onboardingProgress = serializeOnboardingProgress(progress);
  const progressStats = buildOnboardingProgressStats(progress, checklistSteps);
  return {
    onboardingProgress: {
      ...onboardingProgress,
      ...progressStats,
    },
    checklistSteps,
    checklistVisible: isChecklistVisible(progress, checklistSteps, now),
    ...progressStats,
  };
}

module.exports = {
  CHECKLIST_SNOOZE_MS,
  defaultOnboardingProgress,
  isChecklistComplete,
  isChecklistSnoozed,
  isChecklistVisible,
  snoozeChecklist,
  serializeOnboardingProgress,
  buildOnboardingProgressStats,
  buildOnboardingChecklistPayload,
};
