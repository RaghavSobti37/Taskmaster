import React from 'react';
import ListPageSkeleton from './ListPageSkeleton';

/** In-shell route chunk fallback — not full-screen BootScreen. */
export default function RouteContentSkeleton() {
  return <ListPageSkeleton statCount={0} showToolbar={false} tableRows={6} />;
}
