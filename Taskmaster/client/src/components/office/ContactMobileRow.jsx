import React from 'react';
import { Badge } from '../ui/primitives';

const compactBadge = '!text-[9px] !px-1.5 !py-0 shrink-0 uppercase';

/**
 * Dense 3-line mobile row for office contacts lists (< lg).
 */
export default function ContactMobileRow({ contact }) {
  const name = contact.name?.trim();
  const role = contact.role?.trim();
  const phone = contact.phone?.trim();
  const email = contact.email?.trim();
  const notes = contact.notes?.trim();

  return (
    <div className="space-y-0.5 w-full min-w-0 py-0.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="tm-data-primary text-sm font-bold truncate flex-1 min-w-0" title={name}>
          {name}
        </span>
        {role ? (
          <Badge variant="info" className={`${compactBadge} max-w-[45%] truncate`} title={role}>
            {role}
          </Badge>
        ) : null}
      </div>

      <p className="text-[10px] text-[var(--color-text-muted)] truncate min-w-0">
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="font-semibold text-[var(--color-text-primary)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {phone}
          </a>
        ) : (
          <span className="text-[var(--color-text-muted)]/70">No phone</span>
        )}
        <span className="mx-1 text-[var(--color-text-muted)]/70" aria-hidden>
          ·
        </span>
        {email ? (
          <span className="truncate" title={email}>
            {email}
          </span>
        ) : (
          <span className="text-[var(--color-text-muted)]/70">No email</span>
        )}
      </p>

      {notes ? (
        <p className="text-[10px] text-[var(--color-text-muted)] line-clamp-1" title={notes}>
          {notes}
        </p>
      ) : null}
    </div>
  );
}
