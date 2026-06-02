import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, RefreshCw, BarChart3, Star, Database } from 'lucide-react';
import {
  PageContainer, PageHeader, Card, DataTable, Button, Input,
  Badge, NexusDropdown,
} from '../../components/ui';
import DataHubFolderSidebar from '../../components/dataHub/DataHubFolderSidebar';
import DataHubStatsBar from '../../components/dataHub/DataHubStatsBar';
import DataHubPersonDetail from '../../components/dataHub/DataHubPersonDetail';
import DataHubAnalyticsPanel from '../../components/dataHub/DataHubAnalyticsPanel';
import DataHubTscImport from '../../components/dataHub/DataHubTscImport';
import {
  useDataHubFolders,
  useDataHubPeople,
  useDataHubAnalytics,
  useDataHubReconcile,
  useDataHubSyncStatus,
  useDataHubBackups,
  useDataHubProductionBackup,
  DATA_HUB_REFRESH_MS,
} from '../../hooks/useTaskmasterQueries';
import { useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../../hooks/useDebounce';
import { dedupeInletEntries } from '../../utils/dataHubInlets';
import { emitSystemEvent } from '../../lib/systemLogBridge';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

const INLET_COLORS = {
  exly: 'info', leads: 'mint', tsc: 'neutral', booked_calls: 'warning',
  enquiries: 'rose', mail: 'info', community: 'success',
};

const AUTO_SYNC_MS = DATA_HUB_REFRESH_MS;

function formatLastSynced(date) {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60 * 1000) return 'Just now';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(date).toLocaleString();
}

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

export function DataHubContent() {
  const [activeFolder, setActiveFolder] = useState('all');
  const [tscSubFilter, setTscSubFilter] = useState(null);
  const [tscSubFilterParams, setTscSubFilterParams] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [emailStatusFilter, setEmailStatusFilter] = useState('all');

  const queryClient = useQueryClient();
  const { confirm } = useConfirm();
  const toast = useToast();
  const { data: folderData } = useDataHubFolders();
  const reconcileMutation = useDataHubReconcile();
  const backupMutation = useDataHubProductionBackup();
  const { data: syncStatus } = useDataHubSyncStatus();
  const { data: backupStatus } = useDataHubBackups();
  const autoSyncInFlight = useRef(false);
  const reconcileRef = useRef(reconcileMutation);
  reconcileRef.current = reconcileMutation;

  const runIncrementalSync = useCallback(async () => {
    if (autoSyncInFlight.current || reconcileRef.current.isPending) return;
    autoSyncInFlight.current = true;
    try {
      await reconcileRef.current.mutateAsync({ full: false });
    } catch {
      // silent for background sync
    } finally {
      autoSyncInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    runIncrementalSync();
    const id = setInterval(runIncrementalSync, AUTO_SYNC_MS);
    return () => clearInterval(id);
  }, [runIncrementalSync]);

  const peopleParams = useMemo(() => ({
    folder: activeFolder,
    search: debouncedSearch,
    page,
    limit: pageSize,
    emailStatus: emailStatusFilter !== 'all' ? emailStatusFilter : undefined,
    ...(tscSubFilterParams?.campaign ? { campaign: tscSubFilterParams.campaign } : {}),
    ...(tscSubFilterParams?.originSource ? { originSource: tscSubFilterParams.originSource } : {}),
  }), [activeFolder, debouncedSearch, page, pageSize, emailStatusFilter, tscSubFilterParams]);

  const { data: peopleData, isLoading } = useDataHubPeople(peopleParams);
  const { data: analytics } = useDataHubAnalytics(activeFolder);

  const folders = folderData?.folders || [];
  const folderCounts = folderData?.counts || {};
  const lastSyncedAt = syncStatus?.lastSyncedAt || syncStatus?.lastStats?.syncedAt;
  const latestBackup = backupStatus?.snapshots?.[0];
  const backupDbLabel = backupStatus?.backupDatabase || 'taskmaster_backups';

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dataHub'] });
  };

  const handleReconcile = async () => {
    try {
      await reconcileMutation.mutateAsync({ full: false });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    }
  };

  const handleFullReconcile = async () => {
    const ok = await confirm({
      title: 'Full re-merge?',
      message: 'Re-merges all Data Hub inlets from scratch. This may take a few minutes.',
      confirmLabel: 'Run full re-merge',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await reconcileMutation.mutateAsync({ full: true });
      handleRefresh();
      toast.success('Full re-merge completed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Full sync failed');
    }
  };

  const handleProductionBackup = async () => {
    const lastLabel = latestBackup?.date
      ? `Latest snapshot: ${latestBackup.date} (${formatBytes(latestBackup.totalBytes)}).`
      : 'No snapshots found yet.';
    const ok = window.confirm(
      `Back up the full production MongoDB into Atlas GridFS (${backupDbLabel})?\n\n`
      + `${lastLabel}\n`
      + 'This may take 1–2 minutes. You will get a success email when done.'
    );
    if (!ok) return;

    try {
      const { data } = await backupMutation.mutateAsync({ notify: true });
      const warning = data.warning ? ` ${data.warning}` : '';
      emitSystemEvent({
        severity: 'SUCCESS',
        module: 'BACKUP',
        message: `Backup ${data.date}: ${data.collectionCount} collections, ${formatBytes(data.totalBytes)} compressed.${warning}`,
      });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Backup failed';
      emitSystemEvent({
        severity: 'ERROR',
        module: 'BACKUP',
        message: msg,
      });
    }
  };

  const columns = [
    {
      header: 'Person',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-center font-black text-[10px] shrink-0">
            {item.name?.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[11px] font-black uppercase tracking-tight truncate">{item.name}</p>
              {item.isMultiInlet && <Star size={10} className="text-amber-400" />}
            </div>
            <p className="text-[9px] text-[var(--color-text-muted)] font-bold truncate">
              {item.email || '—'} {item.phone ? `· ${item.phone}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Inlets',
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          {(dedupeInletEntries(item.inlets || [])).map((inlet) => (
            <Badge key={inlet.key} variant={INLET_COLORS[inlet.key] || 'neutral'}>
              {inlet.key}
            </Badge>
          ))}
          {item.inletCount >= 2 && (
            <Badge variant="warning" title="Merged from multiple sources">{item.inletCount} inlets</Badge>
          )}
        </div>
      ),
    },
    {
      header: 'City',
      render: (item) => <span className="text-[10px] font-bold uppercase">{item.city || '—'}</span>,
    },
    {
      header: 'Email status',
      render: (item) => (
        <Badge variant={item.emailStatus === 'Active' ? 'mint' : item.emailStatus === 'Unsubscribed' ? 'warning' : 'neutral'}>
          {item.emailStatus || 'Pending'}
        </Badge>
      ),
    },
    {
      header: 'Updated',
      render: (item) => (
        <span className="text-[9px] text-[var(--color-text-muted)]">
          {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="flex gap-4 min-h-[calc(100vh-14rem)]">
        <DataHubFolderSidebar
          folders={folders}
          activeFolder={activeFolder}
          onSelect={(key) => { setActiveFolder(key); setPage(1); }}
          tscSubFilter={tscSubFilter}
          onTscSubFilter={(key, filter) => {
            setTscSubFilter(key);
            setTscSubFilterParams(filter || null);
            setPage(1);
          }}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          <DataHubStatsBar
            folder={activeFolder}
            folderCounts={folderCounts}
            analytics={analytics}
            total={peopleData?.total ?? 0}
          />

          <Card className="px-3 py-2 mb-4 overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 w-full">
              <div className="min-w-0">
                <Input
                  icon={Search}
                  placeholder="Search name, email, phone…"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  className="!py-1.5 !min-h-[2.25rem]"
                />
              </div>
              <div className="w-[128px] shrink-0">
                <NexusDropdown
                  className="!w-full !max-w-[128px]"
                  variant="compact"
                  placeholder="Status"
                  value={emailStatusFilter}
                  onChange={(v) => { setEmailStatusFilter(v); setPage(1); }}
                  options={[
                    { value: 'all', label: 'All statuses' },
                    { value: 'Active', label: 'Active' },
                    { value: 'Unsubscribed', label: 'Unsubscribed' },
                    { value: 'Bounced', label: 'Bounced' },
                    { value: 'Pending', label: 'Pending' },
                  ]}
                />
              </div>
              <div className="flex items-center gap-1 shrink-0 justify-end">
                <span className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase whitespace-nowrap hidden lg:inline">
                  {reconcileMutation.isPending
                    ? 'Syncing…'
                    : `Synced ${formatLastSynced(lastSyncedAt)}`}
                  {latestBackup?.date && !reconcileMutation.isPending && (
                    <> · Backup {latestBackup.date}</>
                  )}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="!px-2.5 whitespace-nowrap"
                  onClick={handleProductionBackup}
                  disabled={backupMutation.isPending || reconcileMutation.isPending}
                  title={`Full production DB backup → ${backupDbLabel} (GridFS, 7-day retention)`}
                >
                  <Database size={14} className={backupMutation.isPending ? 'animate-pulse' : ''} />
                  {backupMutation.isPending ? 'Backing up…' : 'DB Backup'}
                </Button>
                <DataHubTscImport onImported={handleRefresh} compact />
                <Button variant="secondary" size="sm" className="!px-2.5 whitespace-nowrap" onClick={handleReconcile} disabled={reconcileMutation.isPending} title="Pull new/changed records from all inlets">
                  <RefreshCw size={14} className={reconcileMutation.isPending ? 'animate-spin' : ''} />
                  Incremental sync
                </Button>
                <Button variant="secondary" size="sm" className="!px-2.5 whitespace-nowrap" onClick={handleFullReconcile} disabled={reconcileMutation.isPending} title="Full re-merge from all inlets — slower, use when data looks wrong">
                  Full re-merge
                </Button>
                <Button variant="ghost" size="sm" className="!px-2.5 whitespace-nowrap" onClick={() => setShowAnalytics(!showAnalytics)}>
                  <BarChart3 size={14} />
                  Analytics
                </Button>
                <Button variant="ghost" size="sm" className="!px-2" onClick={handleRefresh} title="Refresh">
                  <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                </Button>
              </div>
            </div>
          </Card>

          <DataTable
            columns={columns}
            data={peopleData?.data || []}
            onRowClick={(item) => setSelectedPersonId(item._id)}
            paginated
            serverSide
            totalItems={peopleData?.total || 0}
            totalPages={peopleData?.pages || 0}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        </div>

        <DataHubAnalyticsPanel
          analytics={analytics}
          folder={activeFolder}
          showPanel={showAnalytics}
          onClose={() => setShowAnalytics(false)}
        />
      </div>

      <DataHubPersonDetail
        contactId={selectedPersonId}
        onClose={() => setSelectedPersonId(null)}
      />
    </>
  );
}

export default function DataHubPage() {
  return (
    <PageContainer className="!py-4 !space-y-4">
      <PageHeader
        title="Data Hub"
        subtitle="Single source for all people data — Exly, Leads, TSC, Booked Calls, Enquiries, Mail, and more."
      />
      <DataHubContent />
    </PageContainer>
  );
}
