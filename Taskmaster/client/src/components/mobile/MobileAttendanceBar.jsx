import React, { lazy, Suspense } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useBreakpoint';
import {
  useAttendance,
  useAttendanceCheck,
  useUndoAttendanceCheck,
} from '../../hooks/useTaskmasterQueries';
import { formatDateKeyIST } from '../../utils/attendanceUtils';
import { isAttendanceExcluded } from '../../utils/attendanceUsers';

const UnifiedTimeCard = lazy(() => import('../attendance/UnifiedTimeCard'));

function AttendanceBarSkeleton() {
  return (
    <div
      className="h-24 rounded-[var(--radius-md)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] animate-pulse"
      aria-hidden
    />
  );
}

export default function MobileAttendanceBar() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const enabled = isMobile && !!user?._id && !isAttendanceExcluded(user);

  const todayKey = formatDateKeyIST();
  const { data: attendanceRows = [] } = useAttendance(
    { start: todayKey, end: todayKey, mine: 'true' },
    enabled
  );
  const checkIn = useAttendanceCheck();
  const undoCheck = useUndoAttendanceCheck();

  if (!enabled) return null;

  const entry = attendanceRows[0];

  const executeAttendanceCheck = (type, manualTime, workMode) => {
    checkIn.mutate({ type, manualTime, workMode: workMode === 'wfh' ? 'wfh' : 'office' });
  };

  return (
    <div className="lg:hidden mb-[var(--page-stack-gap)] rounded-[var(--radius-md)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] overflow-hidden">
      <Suspense fallback={<AttendanceBarSkeleton />}>
        <div className="p-2">
          <UnifiedTimeCard
            compact
            hideTitleRow
            alwaysShowMarkInAccess
            entry={entry}
            isSelfMode
            onCheckIn={(t, workMode) => executeAttendanceCheck('in', t, workMode)}
            onCheckOut={(t, workMode) => executeAttendanceCheck('out', t, workMode)}
            onUndo={(type) => undoCheck.mutate({ type })}
            isLoading={checkIn.isPending}
          />
        </div>
      </Suspense>
    </div>
  );
}
