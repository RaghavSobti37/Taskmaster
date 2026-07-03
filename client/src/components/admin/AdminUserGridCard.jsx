import React from 'react';
import { FileText, Pencil } from 'lucide-react';
import { Button, StatusBadge, UserAvatar } from '../ui';
import { isAdminUser } from '../../utils/departmentPermissions';

export default function AdminUserGridCard({ user, onEdit, onViewReport, metaLabel }) {
  const badgeText = metaLabel ?? (user.departmentId?.name || 'Unassigned');

  return (
    <article className="flex flex-col gap-3 p-4 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] hover:border-[var(--color-action-primary)]/40 transition-colors">
      <button
        type="button"
        onClick={() => onEdit(user)}
        className="flex items-start gap-3 text-left min-w-0 w-full"
      >
        <UserAvatar user={user} size="md" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-[var(--color-text-primary)] truncate">{user.name}</span>
            <StatusBadge role={isAdminUser(user) ? 'error' : 'neutral'} className="!text-[9px] uppercase font-mono shrink-0">
              {badgeText}
            </StatusBadge>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">{user.email}</p>
        </div>
      </button>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => onViewReport(user)}
        >
          <FileText size={14} aria-hidden />
          View report
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => onEdit(user)}
          aria-label={`Edit ${user.name}`}
        >
          <Pencil size={14} aria-hidden />
          Edit
        </Button>
      </div>
    </article>
  );
}
