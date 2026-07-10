import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { DashboardWidgetShell, DataListRow, Badge, DataLoading } from '../ui';
import { LOADING_SHOW_PHRASE_DASHBOARD } from '../../lib/loadingDisplay';
import { useMyReimbursements } from '../../hooks/useTaskmasterQueries';
import { formatProjectName } from '../../utils/projectUtils';

const STATUS_STYLES = {
  pending: { label: 'Pending', className: 'text-amber-600 bg-amber-500/10', icon: Clock },
  approved: { label: 'Approved', className: 'text-emerald-600 bg-emerald-500/10', icon: CheckCircle },
  rejected: { label: 'Rejected', className: 'text-rose-600 bg-rose-500/10', icon: XCircle },
};

function ReimbursementsCard() {
  const { data: items = [], isLoading } = useMyReimbursements();
  const rows = useMemo(() => items.slice(0, 8), [items]);

  return (
    <DashboardWidgetShell
      className="h-full overflow-hidden"
      bodyClassName="p-0 flex flex-col flex-1 min-h-0"
      title="Reimbursements"
      icon={Receipt}
      actions={
        rows.length > 0 ? <Badge variant="slate">{rows.length}</Badge> : null
      }
    >
      <p className="text-[9px] text-[var(--color-text-muted)] px-4 pt-2 pb-1">
        Claims submitted from Settings → Reimbursement
      </p>
      <div className="flex-1 min-h-0 max-h-[min(40vh,16rem)] overflow-y-auto">
        {isLoading && <DataLoading className="py-8" showPhrase={LOADING_SHOW_PHRASE_DASHBOARD} />}
        {!isLoading && rows.length === 0 && (
          <p className="text-[10px] text-[var(--color-text-muted)] italic text-center py-8 px-4">
            No reimbursement claims yet
          </p>
        )}
        {!isLoading &&
          rows.map((item) => {
            const status = STATUS_STYLES[item.approvalStatus] || STATUS_STYLES.pending;
            const StatusIcon = status.icon;
            const amount = item.metadata?.amount
              ? `₹${Number(item.metadata.amount).toLocaleString('en-IN')}`
              : null;
            return (
              <DataListRow
                key={item._id}
                primary={
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-bold truncate">{item.title || 'Reimbursement'}</span>
                    {amount && (
                      <span className="text-[10px] font-mono tabular-nums text-[var(--color-text-secondary)] shrink-0">
                        {amount}
                      </span>
                    )}
                  </div>
                }
                secondary={
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                      {item.project?.name && (
                        <span>{formatProjectName(item.project.name)}</span>
                      )}
                      {item.metadata?.vendor && <span>· {item.metadata.vendor}</span>}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${status.className}`}
                    >
                      <StatusIcon size={10} />
                      {status.label}
                      {item.createdAt && (
                        <span className="text-[var(--color-text-muted)] font-normal ml-1">
                          · {formatDisplayDate(new Date(item.createdAt))}
                        </span>
                      )}
                    </span>
                  </>
                }
              />
            );
          })}
      </div>
      <div className="px-4 py-2 border-t border-[var(--color-bg-border)] shrink-0">
        <Link
          to="/settings?tab=invoice"
          className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-action-primary)] hover:underline"
        >
          Submit in Settings →
        </Link>
      </div>
    </DashboardWidgetShell>
  );
}

export default ReimbursementsCard;
