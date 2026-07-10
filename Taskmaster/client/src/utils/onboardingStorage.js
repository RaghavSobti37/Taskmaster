const STORAGE_PREFIX = 'coreknot_onboarding_v1';
const VERSION = 1;

export function onboardingStorageKey(userId) {
  return `${STORAGE_PREFIX}_${userId || 'anon'}`;
}

export function hasCompletedOnboarding(userId) {
  if (!userId || typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(onboardingStorageKey(userId));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed?.version === VERSION && parsed?.completed === true;
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(userId) {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      onboardingStorageKey(userId),
      JSON.stringify({ version: VERSION, completed: true, completedAt: new Date().toISOString() })
    );
  } catch {
    /* ignore quota errors */
  }
}

export function resetOnboarding(userId) {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.removeItem(onboardingStorageKey(userId));
  } catch {
    /* ignore */
  }
}
