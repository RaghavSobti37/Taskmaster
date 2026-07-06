import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UNLOCK_ALL, useTenantUnlocks } from '../../hooks/useTenantUnlocks';
import EmptyState from '../ui/EmptyState';

const DEFAULT_LOCK = {
  lockedReason: 'Complete onboarding to unlock this area',
  unlockCta: 'View checklist',
  unlockPath: '/dashboard',
};

/**
 * Wraps page content gated by tenant featureUnlocks.
 * ponytail: UNLOCK_ALL bypasses until billing gates are live.
 */
export default function TenantFeatureGate({
  featureKey,
  path,
  children,
  title = 'Feature locked',
  description,
}) {
  const navigate = useNavigate();
  const { isFeatureUnlocked, getFeatureLock } = useTenantUnlocks();

  if (UNLOCK_ALL) return children;

  const lock = getFeatureLock(path) ?? (!isFeatureUnlocked(featureKey) ? DEFAULT_LOCK : null);

  if (!lock) return children;

  return (
    <EmptyState
      title={title}
      description={description}
      lockedReason={lock.lockedReason}
      unlockCta={lock.unlockCta}
      onUnlock={() => navigate(lock.unlockPath || '/dashboard')}
    />
  );
}
