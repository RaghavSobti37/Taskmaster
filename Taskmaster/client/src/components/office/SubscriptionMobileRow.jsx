import React from 'react';
import { Badge } from '../ui/primitives';
import { UserLabel } from '../ui/UserAvatar';
import { formatDisplayDate } from '../../utils/dateDisplay';

const compactBadge = '!text-[9px] !px-1.5 !py-0 shrink-0';

const formatInr = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);

const normalizeUsedByUsers = (usedBy) => {
  if (!usedBy) return [];
  return Array.isArray(usedBy) ? usedBy : [usedBy];
};

/**
 * Dense 3-line mobile row for subscriptions lists (< lg).
 */
export default function SubscriptionMobileRow({ subscription: sub }) {
  const name = sub.name?.trim();
  const type = sub.type?.trim();
  const periodicity = sub.periodicity?.trim();
  const dueLabel = sub.dueDate ? formatDisplayDate(new Date(sub.dueDate)) : '—';
  const users = normalizeUsedByUsers(sub.usedBy).filter((user) => user?.name || user?._id);
  const primaryUser = users[0];
  const extraUsers = users.length > 1 ? users.length - 1 : 0;

  return (
    <div className="space-y-0.5 w-full min-w-0 py-0.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="tm-data-primary text-sm font-bold truncate flex-1 min-w-0" title={name}>
          {name}
        </span>
        <span className="text-[11px] font-bold tabular-nums text-[var(--color-text-primary)] shrink-0">
          {formatInr(sub.amount)}
        </span>
      </div>

      <div className="flex items-center gap-1.5 min-w-0 text-[10px] text-[var(--color-text-muted)]">
        <span className="tabular-nums shrink-0">{dueLabel}</span>
        {(type || periodicity) ? (
          <>
            <span className="text-[var(--color-text-muted)]/70 shrink-0" aria-hidden>
              ·
            </span>
            <div className="flex items-center gap-1 min-w-0 truncate">
              {type ? (
                <Badge variant="info" className={`${compactBadge} max-w-[45%] truncate opacity-80`} title={type}>
                  {type}
                </Badge>
              ) : null}
              {type && periodicity ? (
                <span className="text-[var(--color-text-muted)]/70 shrink-0" aria-hidden>
                  ·
                </span>
              ) : null}
              {periodicity ? (
                <Badge variant="mint" className={`${compactBadge} max-w-[45%] truncate opacity-80`} title={periodicity}>
                  {periodicity}
                </Badge>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {primaryUser ? (
        <div className="flex items-center gap-1.5 min-w-0">
          <UserLabel
            user={primaryUser}
            size="xs"
            nameClassName="text-[10px] font-medium text-[var(--color-text-muted)] truncate"
            className="min-w-0 flex-1"
          />
          {extraUsers > 0 ? (
            <span className="text-[10px] text-[var(--color-text-muted)] shrink-0 tabular-nums">
              +{extraUsers}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-[10px] text-[var(--color-text-muted)]/70">Unassigned</p>
      )}
    </div>
  );
}
