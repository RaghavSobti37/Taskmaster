import React from 'react';
import { useDeferredMountTier } from '../../hooks/useDeferredMount';
import PageSkeleton from './PageSkeleton';

/** Renders fallback until deferred mount tier fires, then children. */
export default function ProgressiveSection({ tier = 0, fallback, children, className }) {
  const ready = useDeferredMountTier(tier);
  if (!ready) {
    return fallback ?? <PageSkeleton className={className} />;
  }
  return <>{children}</>;
}
