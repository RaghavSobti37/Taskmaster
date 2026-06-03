import React, { useEffect, useMemo, useState } from 'react';
import { Database, CheckCircle2, AlertCircle, Play, Loader2 } from 'lucide-react';
import { DashboardWidgetShell, Badge, Button, ProgressBar } from '../ui';
import {
  useDataHubBackups,
  useDataHubBackupProgress,
  useDataHubProductionBackup,
} from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { formatTimestampWithTz } from '../../utils/displayLabels';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function LastBackupCard() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const [watchProgress, setWatchProgress] = useState(false);
  const [runError, setRunError] = useState(null);

  const { data, isLoading, isError, refetch } = useDataHubBackups({ enabled: isAdmin });
  const { data: progress } = useDataHubBackupProgress(isAdmin, watchProgress);
  const backupMutation = useDataHubProductionBackup();

  const isRunning = progress?.status === 'running' || backupMutation.isPending;

  useEffect(() => {
    if (progress?.status === 'running') {
      setWatchProgress(true);
    }
  }, [progress?.status]);

  useEffect(() => {
    if (progress?.status === 'completed') {
      setWatchProgress(false);
      setRunError(null);
      refetch();
    }
    if (progress?.status === 'failed') {
      setWatchProgress(false);
      setRunError(progress.error || progress.result?.error || 'Backup failed');
    }
  }, [progress?.status, progress?.error, progress?.result, refetch]);

  const latest = useMemo(() => {
    const snapshots = data?.snapshots || [];
    return snapshots.find((s) => s.status === 'completed') || null;
  }, [data]);

  const completedAtLabel = latest?.createdAt
    ? formatTimestampWithTz(latest.createdAt, 'MMM dd, yyyy · HH:mm:ss')
    : null;

  const handleRunBackup = async () => {
    setRunError(null);
    setWatchProgress(true);
    try {
      await backupMutation.mutateAsync({ notify: true });
    } catch (err) {
      setWatchProgress(false);
      setRunError(err.response?.data?.error || err.message || 'Backup failed');
    }
  };

  const progressLabel = progress?.totalCollections
    ? `${progress.completedCollections}/${progress.totalCollections} collections`
    : 'Preparing…';

  return (
    <DashboardWidgetShell
      title="Last Backup"
      icon={Database}
      bodyClassName="p-4 flex flex-col justify-center min-h-[120px]"
      actions={
        isAdmin ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRunBackup}
            disabled={isRunning}
            className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider"
          >
            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {isRunning ? 'Running…' : 'Run'}
          </Button>
        ) : null
      }
    >
      {isRunning && (
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            <span>Backing up production</span>
            <span className="tabular-nums">{progress?.percent ?? 0}%</span>
          </div>
          <ProgressBar progress={progress?.percent ?? 0} color="bg-emerald-500" />
          <p className="text-[10px] text-[var(--color-text-secondary)] truncate">
            {progressLabel}
            {progress?.currentCollection ? ` · ${progress.currentCollection}` : ''}
          </p>
        </div>
      )}

      {runError && !isRunning && (
        <div className="flex items-start gap-2 text-rose-600 dark:text-rose-400 mb-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs font-medium">{runError}</p>
        </div>
      )}

      {isLoading && !isRunning && (
        <p className="text-xs text-[var(--color-text-muted)]">Loading backup status…</p>
      )}
      {!isLoading && isError && !isRunning && (
        <div className="flex items-start gap-2 text-rose-600 dark:text-rose-400">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p className="text-xs font-medium">Could not load backup status</p>
        </div>
      )}
      {!isLoading && !isError && !latest && !isRunning && (
        <p className="text-xs text-[var(--color-text-muted)] italic">No successful backup on record</p>
      )}
      {!isLoading && !isError && latest && (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Last successful backup
              </p>
              <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5 tabular-nums">
                {completedAtLabel}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Snapshot date · {latest.date}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success" className="text-[9px]">
              {latest.collectionCount} collections
            </Badge>
            <Badge variant="neutral" className="text-[9px]">
              {formatBytes(latest.totalBytes)} compressed
            </Badge>
          </div>
        </div>
      )}
    </DashboardWidgetShell>
  );
}
