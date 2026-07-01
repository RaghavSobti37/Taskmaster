import React from 'react';
import { Skeleton } from './primitives';
import HubPageLayout from './HubPageLayout';
import ListPageSkeleton from './ListPageSkeleton';

/** Hub tab panel placeholder — keeps real subnav slot shape, skeletons list body only. */
export default function HubPageSkeleton(props) {
  return (
    <HubPageLayout
      header={(
        <div className="flex flex-col gap-3 min-w-0 px-1 py-1" aria-hidden>
          <div className="flex items-center gap-3 min-w-0">
            <Skeleton variant="circle" width="32px" height="32px" />
            <Skeleton width="140px" height="14px" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="88px" height="32px" className="rounded-md" />
            ))}
          </div>
        </div>
      )}
    >
      <ListPageSkeleton {...props} bare className={props.className || ''} />
    </HubPageLayout>
  );
}
