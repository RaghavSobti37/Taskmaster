import React from 'react';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import { DashboardWidgetShell } from '../ui';
import UnifiedTimeCard from '../attendance/UnifiedTimeCard';

function MarkAttendanceCard({
  entry,
  onCheckIn,
  onCheckOut,
  onUndo,
  isLoading,
}) {
  const todayLabel = format(new Date(), 'EEE, MMM d');

  return (
    <DashboardWidgetShell
      title="Clock In / Out"
      icon={Clock}
      actions={
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
          {todayLabel}
        </span>
      }
      bodyClassName="p-3"
    >
      <UnifiedTimeCard
        compact
        hideTitleRow
        entry={entry}
        isSelfMode
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
        onUndo={onUndo}
        isLoading={isLoading}
      />
    </DashboardWidgetShell>
  );
}

export default MarkAttendanceCard;
