import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { DashboardWidgetShell, DataListRow, Badge, DataLoading } from '../ui';
import { LOADING_SHOW_PHRASE_DASHBOARD } from '../../lib/loadingDisplay';
import { useLeaveRequests } from '../../hooks/useTaskmasterQueries';
import { isOpsUser } from '../../utils/departmentPermissions';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_STYLES = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'mint' },
  rejected: { label: 'Rejected', variant: 'rose' },
  cancelled: { label: 'Cancelled', variant: 'slate' },
};

const formatDateRange = (from, to) => {
  if (!from && !to) return '—';
  const f = from ? format(new Date(from), 'MMM d, yyyy') : '?';
  const t = to ? format(new Date(to), 'MMM d, yyyy') : f;
  return f === t ? f : `${f} → ${t}`;
};

export default function LeaveRequestsCard() {
  const { user } = useAuth();
  const opsView = isOpsUser(user);
  const { data = [], isLoading } = useLeaveRequests(
    opsView ? { status: 'pending' } : {},
    !!user
  );

  const rows = useMemo(() => data.slice(0, 8), [data]);

  const footerLink = opsView ? '/attendance' : '/settings?tab=leave';
  const footerLabel = opsView ? 'Manage on Attendance' : 'Apply in Settings';

  return (
    <DashboardWidgetShell
      className="h-full overflow-hidden"
      bodyClassName="p-0 flex flex-col flex-1 min-h-0"
      title="Leave Requests"
      icon={CalendarDays}
      actions={
        rows.length > 0 ? (
          <Badge variant={opsView ? 'warning' : 'slate'}>{rows.length}</Badge>
        ) : null
      }
    >
      <p className="text-[9px] text-[var(--color-text-muted)] px-4 pt-2 pb-1">
        {opsView ? 'Pending leave awaiting approval' : 'Your leave submissions from Settings'}
      </p>
      <div className="flex-1 min-h-0 max-h-[min(40vh,16rem)] overflow-y-auto">
        {isLoading && <DataLoading className="py-8" showPhrase={LOADING_SHOW_PHRASE_DASHBOARD} />}
        {!isLoading && rows.length === 0 && (
          <p className="text-[10px] text-[var(--color-text-muted)] italic text-center py-8 px-4">
            {opsView ? 'No pending leave requests' : 'No leave requests yet'}
          </p>
        )}
        {!isLoading &&
          rows.map((item) => {
            const status = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
            const requester = item.userId?.name || user?.name || 'You';
            return (
              <DataListRow
                key={item._id}
                primary={
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-bold truncate">
                      {opsView ? requester : formatDateRange(item.fromDate, item.toDate)}
                    </span>
                    <Badge variant={status.variant} className="!py-0 !px-1.5 !text-[9px] ml-auto shrink-0">
                      {status.label}
                    </Badge>
                  </div>
                }
                secondary={
                  <>
                    {opsView && (
                      <p className="text-[10px] text-[var(--color-text-secondary)]">
                        {formatDateRange(item.fromDate, item.toDate)}
                      </p>
                    )}
                    {item.reason && (
                      <p className="text-[10px] text-[var(--color-text-muted)] line-clamp-2">{item.reason}</p>
                    )}
                    <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1">
                      {item.status === 'approved' && <CheckCircle size={10} className="text-emerald-500" />}
                      {item.status === 'rejected' && <XCircle size={10} className="text-rose-500" />}
                      {item.status === 'pending' && <Clock size={10} />}
                      Submitted{' '}
                      {item.createdAt
                        ? format(new Date(item.createdAt), 'MMM d, yyyy')
                        : '—'}
                    </p>
                  </>
                }
              />
            );
          })}
      </div>
      <div className="px-4 py-2 border-t border-[var(--color-bg-border)] shrink-0">
        <Link
          to={footerLink}
          className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-action-primary)] hover:underline"
        >
          {footerLabel} →
        </Link>
      </div>
    </DashboardWidgetShell>
  );
}
