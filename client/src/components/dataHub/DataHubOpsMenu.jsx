import React, { useState } from 'react';
import { MoreVertical, Database, RefreshCw } from 'lucide-react';
import { Button } from '../ui';
import DataHubTscImport from './DataHubTscImport';

export default function DataHubOpsMenu({
  syncLabel,
  onBackup,
  onIncrementalSync,
  onFullReconcile,
  onImported,
  backupPending,
  reconcilePending,
  reconcileEnabled,
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="relative shrink-0">
      <Button
        variant="ghost"
        size="sm"
        className="!px-2.5 whitespace-nowrap"
        onClick={() => setOpen((v) => !v)}
        title="Backup, sync, and import"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreVertical size={14} />
        Data ops
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
          <div
            role="menu"
            className="tm-floating absolute right-0 top-full mt-1 z-50 min-w-[220px] py-2 px-2 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] shadow-xl space-y-1"
          >
            {syncLabel && (
              <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase px-2 pb-1 border-b border-[var(--color-bg-border)] mb-1">
                {syncLabel}
              </p>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start !px-2.5"
              onClick={() => { onBackup(); close(); }}
              disabled={backupPending || reconcilePending}
            >
              <Database size={14} className={backupPending ? 'animate-pulse' : ''} />
              {backupPending ? 'Backing up…' : 'DB Backup'}
            </Button>
            <div className="w-full" onClick={close}>
              <DataHubTscImport onImported={onImported} compact className="w-full justify-start" />
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start !px-2.5"
              onClick={() => { onIncrementalSync(); close(); }}
              disabled={!reconcileEnabled || reconcilePending}
              title={reconcileEnabled ? 'Pull new/changed records from all inlets' : 'Disabled in local dev'}
            >
              <RefreshCw size={14} className={reconcilePending ? 'animate-spin' : ''} />
              Incremental sync
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start !px-2.5"
              onClick={() => { onFullReconcile(); close(); }}
              disabled={!reconcileEnabled || reconcilePending}
              title={reconcileEnabled ? 'Full re-merge from all inlets' : 'Disabled in local dev'}
            >
              Full re-merge
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
