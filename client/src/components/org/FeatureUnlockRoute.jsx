import { Outlet } from 'react-router-dom';
import { useOrg } from '../../contexts/OrgContext';
import { useTenantUnlocks } from '../../hooks/useTenantUnlocks';
import FeatureLockedState from './FeatureLockedState';

export default function FeatureUnlockRoute({ featureKey }) {
  const org = useOrg();
  const fallback = useTenantUnlocks();

  const isFeatureUnlocked = org?.isFeatureUnlocked || fallback.isFeatureUnlocked;
  const getFeatureLockByKey = org?.getFeatureLockByKey || fallback.getFeatureLockByKey;

  if (!featureKey) return <Outlet />;

  if (isFeatureUnlocked(featureKey)) {
    return <Outlet />;
  }

  const lock = getFeatureLockByKey(featureKey);
  return (
    <FeatureLockedState
      featureKey={featureKey}
      title={lock?.label || 'Feature not enabled'}
      message={lock?.message || 'This feature is not enabled for your organization.'}
    />
  );
}
