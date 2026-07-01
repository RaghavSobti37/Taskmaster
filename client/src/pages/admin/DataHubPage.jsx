import React, { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { RefreshCw, BarChart3, Star, Database, TrendingUp, UserX } from 'lucide-react';
import { DataTable, Button, Badge } from '../../components/ui/primitives';
import StatusBadge from '../../components/ui/StatusBadge';
import ListPageLayout from '../../components/ui/ListPageLayout';
import SearchInput from '../../components/ui/SearchInput';
import { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import { countActiveFilters } from '../../components/ui/selectionFilterUtils';
import { mapKpisToStats } from '../../utils/buildChartSeries';
import { buildDataHubOverviewCharts } from '../../utils/dataHubAnalyticsCharts';
import DataHubOpsMenu from '../../components/dataHub/DataHubOpsMenu';
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
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';
import { useDebounce } from '../../hooks/useDebounce';
import DataHubInletCluster from '../../components/dataHub/DataHubInletCluster';
import DataHubTemporalColumn from '../../components/dataHub/DataHubTemporalColumn';
import { emitSystemEvent } from '../../lib/systemLogBridge';
import { useConfirm } from '../../contexts/confirmContext';
import { useToast } from '../../contexts/ToastContext';

const STICKY_CELL = 'sticky left-0 z-10 bg-[var(--token-surface-1)]';

const DATA_HUB_FILTERS_KEY = 'datahub-filters';

const loadDataHubFilters = () => {
  try {
    const raw = localStorage.getItem(DATA_HUB_FILTERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {
    activeFolder: 'all',
    pageSize: 10,
    emailStatusFilter: 'all',
    showAnalytics: true,
    sortField: 'lastActivity',
    sortOrder: 'desc',
  };
};

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 rows' },
  { value: 25, label: '25 rows' },
  { value: 50, label: '50 rows' },
  { value: 100, label: '100 rows' },
];

const SORT_OPTIONS = [
  { value: 'lastActivity:desc', label: 'Activity (newest)' },
  { value: 'updated:desc', label: 'Updated (newest)' },
  { value: 'name:asc', label: 'Name (A–Z)' },
];

const AUTO_SYNC_MS = DATA_HUB_REFRESH_MS;

const DataHubPersonDetail = lazy(() => import('../../components/dataHub/DataHubPersonDetail'));

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
  const savedFilters = useMemo(() => loadDataHubFilters(), []);
  const [activeFolder, setActiveFolder] = useState(savedFilters.activeFolder);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(savedFilters.pageSize);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(savedFilters.showAnalytics);
  const [emailStatusFilter, setEmailStatusFilter] = useState(savedFilters.emailStatusFilter);
  const [sortField, setSortField] = useState(savedFilters.sortField || 'lastActivity');
  const [sortOrder, setSortOrder] = useState(savedFilters.sortOrder || 'desc');
  const sortValue = `${sortField}:${sortOrder}`;

  useEffect(() => {
    try {
      localStorage.setItem(DATA_HUB_FILTERS_KEY, JSON.stringify({
        activeFolder,
        pageSize,
        emailStatusFilter,
        showAnalytics,
        sortField,
        sortOrder,
      }));
    } catch {
      /* ignore */
    }
  }, [activeFolder, pageSize, emailStatusFilter, showAnalytics, sortField, sortOrder]);

  const queryClient = useQueryClient();
  const { confirm } = useConfirm();
  const toast = useToast();
  const { data: folderData, isError: foldersError, error: foldersErr } = useDataHubFolders();
  const deferDataHubSecondary = useDeferredQueryEnabled(folderData !== undefined);
  const reconcileMutation = useDataHubReconcile();
  const backupMutation = useDataHubProductionBackup();
  const { data: syncStatus } = useDataHubSyncStatus({ enabled: deferDataHubSecondary });
  const reconcileEnabled = syncStatus?.reconcileEnabled !== false;
  const localDevMode = Boolean(syncStatus?.localDevMode);
  const { data: backupStatus } = useDataHubBackups({ enabled: deferDataHubSecondary });
  const autoSyncInFlight = useRef(false);
  const [userSyncActive, setUserSyncActive] = useState(false);
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
    if (!reconcileEnabled) return undefined;
    const lastSync = syncStatus?.lastSyncedAt;
    const recentlySynced = lastSync && (Date.now() - new Date(lastSync).getTime() < 30 * 60 * 1000);
    if (!recentlySynced) {
      runIncrementalSync();
    }
    const id = setInterval(runIncrementalSync, AUTO_SYNC_MS);
    return () => clearInterval(id);
  }, [runIncrementalSync, syncStatus?.lastSyncedAt, reconcileEnabled]);

  const peopleParams = useMemo(() => ({
    folder: activeFolder,
    search: debouncedSearch,
    page,
    limit: pageSize,
    emailStatus: emailStatusFilter !== 'all' ? emailStatusFilter : undefined,
    sort: sortField,
    order: sortOrder,
  }), [activeFolder, debouncedSearch, page, pageSize, emailStatusFilter, sortField, sortOrder]);

  const { data: peopleData, isLoading, isError: peopleError, error: peopleErr } = useDataHubPeople(peopleParams);
  const { data: analytics, isError: analyticsError, error: analyticsErr } = useDataHubAnalytics(activeFolder, { enabled: showAnalytics });

  const queryError = peopleError
    ? peopleErr
    : foldersError
      ? foldersErr
      : (showAnalytics && analyticsError)
        ? analyticsErr
        : null;

  const folders = folderData?.folders || [];
  const folderCounts = folderData?.counts || {};
  const folderOptions = useMemo(
    () => folders.map((folder) => ({
      value: folder.key,
      label: `${folder.label} (${folder.count ?? 0})`,
    })),
    [folders],
  );
  const activeFolderLabel = folders.find((f) => f.key === activeFolder)?.label || 'All people';
  const lastSyncedAt = syncStatus?.lastSyncedAt || syncStatus?.lastStats?.syncedAt;
  const latestBackup = backupStatus?.snapshots?.[0];
  const backupDestination = backupStatus?.destination || 'mongo';
  const backupDbLabel = backupStatus?.backupDatabase || 'taskmaster_backups';
  const backupTargetLabel = backupDestination === 'supabase'
    ? `Supabase Storage (${backupDbLabel})`
    : backupDestination === 'supabase+mongo'
      ? `Supabase + Atlas GridFS`
      : `Atlas GridFS (${backupDbLabel})`;
  const total = peopleData?.total ?? 0;

  const overview = useMemo(() => {
    const KPI_ICONS = {
      total: Database, newWeek: TrendingUp, loyal: Star, unsubRate: UserX,
      revenue: Database, bookings: Database, engaged: Database, active: Database,
      connected: Database, conversion: TrendingUp, openRate: Database, clickRate: Database,
    };
    const kpis = analytics?.kpis;
    let stats = kpis?.length
      ? mapKpisToStats(kpis, KPI_ICONS)
      : [
          { id: 'total', label: activeFolder === 'all' ? 'Total People' : 'In Folder', value: total, icon: Database, variant: 'primary' },
          { id: 'newWeek', label: 'New This Week', value: analytics?.newThisWeek ?? 0, icon: TrendingUp, variant: 'mint' },
          { id: 'loyal', label: 'Loyal (2+ Inlets)', value: folderCounts.loyal ?? analytics?.loyalCount ?? 0, icon: Star, variant: 'warning' },
        ];
    if (!kpis?.length && (activeFolder === 'all' || activeFolder === 'unsubscribed')) {
      const unsubCount = folderCounts.unsubscribed ?? 0;
      const unsubRate = total > 0 && activeFolder === 'all' ? Math.round((unsubCount / total) * 100) : null;
      stats = [
        ...stats,
        {
          id: 'unsub',
          label: activeFolder === 'unsubscribed' ? 'Unsubscribed' : 'Unsub Rate',
          value: activeFolder === 'unsubscribed' ? unsubCount : `${unsubRate ?? 0}%`,
          icon: UserX,
          variant: 'rose',
        },
      ];
    }
    const analyticsCharts = buildDataHubOverviewCharts(analytics, activeFolder);
    const folderChart = Object.entries(folderCounts)
      .filter(([key, val]) => key !== 'all' && Number(val) > 0)
      .map(([label, value]) => ({ label: label.replace(/_/g, ' '), value: Number(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const charts = analyticsCharts.length
      ? analyticsCharts
      : (folderChart.length
        ? [{ id: 'folders', title: 'Folder mix', type: folderChart.length <= 6 ? 'donut' : 'bar', data: folderChart }]
        : []);
    return { stats: stats.slice(0, 4), charts, eagerCharts: analyticsCharts.length > 0 };
  }, [analytics, activeFolder, folderCounts, total]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dataHub'] });
  };

  const handleReconcile = async () => {
    setUserSyncActive(true);
    try {
      await reconcileMutation.mutateAsync({ full: false });
      handleRefresh();
      toast.success('Data Hub synced');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    } finally {
      setUserSyncActive(false);
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
    setUserSyncActive(true);
    try {
      await reconcileMutation.mutateAsync({ full: true });
      handleRefresh();
      toast.success('Full re-merge completed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Full sync failed');
    } finally {
      setUserSyncActive(false);
    }
  };

  const showSyncing = userSyncActive && reconcileMutation.isPending;

  const handleProductionBackup = async () => {
    const lastLabel = latestBackup?.date
      ? `Latest snapshot: ${latestBackup.date} (${formatBytes(latestBackup.totalBytes)}).`
      : 'No snapshots found yet.';
    const ok = await confirm({
      title: 'Back up production database?',
      message: `Back up the full production MongoDB into ${backupTargetLabel}? ${lastLabel} This may take 1–2 minutes. You will get a success email when done.`,
      confirmLabel: 'Start backup',
      type: 'danger',
    });
    if (!ok) return;

    try {
      const data = await backupMutation.mutateAsync({ notify: true });
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
      headerClassName: STICKY_CELL,
      cellClassName: STICKY_CELL,
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
      render: (item) => <DataHubInletCluster inlets={item.inlets || []} />,
    },
    {
      header: 'City',
      render: (item) => <span className="text-[10px] font-bold uppercase">{item.city || '—'}</span>,
    },
    {
      header: 'Email status',
      render: (item) => (
        <StatusBadge status={item.emailStatus === 'Active' ? 'available' : item.emailStatus === 'Unsubscribed' ? 'advisory' : 'neutral'}>
          {item.emailStatus || 'Pending'}
        </StatusBadge>
      ),
    },
    {
      header: 'Last activity',
      render: (item) => (
        <DataHubTemporalColumn
          value={item.lastActivityAt || item.updatedAt}
          label="Last activity"
        />
      ),
    },
  ];

  const syncStatusLabel = showSyncing
    ? 'Syncing…'
    : `Synced ${formatLastSynced(lastSyncedAt)}${latestBackup?.date ? ` · Backup ${latestBackup.date}` : ''}`;

  const handleClearDataHubFilters = useCallback(() => {
    setActiveFolder('all');
    setEmailStatusFilter('all');
    setSortField('lastActivity');
    setSortOrder('desc');
    setPageSize(10);
    setPage(1);
  }, []);

  const dataHubFilterFields = useMemo(() => [
    {
      id: 'folder',
      label: 'Folder',
      type: 'searchable',
      value: activeFolder,
      defaultValue: 'all',
      options: [
        { value: 'all', label: 'All people' },
        ...folderOptions,
      ],
      onChange: (v) => { setActiveFolder(v); setPage(1); },
    },
    {
      id: 'status',
      label: 'Email status',
      type: 'radio',
      value: emailStatusFilter,
      defaultValue: 'all',
      options: [
        { value: 'all', label: 'All statuses' },
        { value: 'Active', label: 'Active' },
        { value: 'Unsubscribed', label: 'Unsubscribed' },
        { value: 'Bounced', label: 'Bounced' },
        { value: 'Pending', label: 'Pending' },
      ],
      onChange: (v) => { setEmailStatusFilter(v); setPage(1); },
    },
    {
      id: 'sort',
      label: 'Sort',
      type: 'radio',
      value: sortValue,
      defaultValue: 'lastActivity:desc',
      options: SORT_OPTIONS,
      onChange: (v) => {
        const [field, order] = String(v).split(':');
        setSortField(field || 'lastActivity');
        setSortOrder(order || 'desc');
        setPage(1);
      },
    },
    {
      id: 'pageSize',
      label: 'Rows per page',
      type: 'radio',
      value: String(pageSize),
      defaultValue: '10',
      options: PAGE_SIZE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label })),
      onChange: (v) => { setPageSize(Number(v)); setPage(1); },
    },
  ], [activeFolder, emailStatusFilter, sortValue, pageSize, folderOptions]);

  return (
    <>
      <ListPageLayout
        containerClassName="!py-4"
        title="Data Hub"
        icon={Database}
        backTo={ADMIN_CONSOLE_PATH}
        toolbarFill
        overview={showAnalytics ? overview : undefined}
        filterFields={dataHubFilterFields}
        filterSheetTitle="Data Hub filters"
        mobileFilterCount={countActiveFilters(dataHubFilterFields)}
        onActiveFiltersClear={handleClearDataHubFilters}
        queryError={queryError}
        onQueryRetry={handleRefresh}
        queryErrorFallback="Failed to load Data Hub data"
        searchBar={(
          <SearchInput
            variant="toolbar"
            placeholder="Search name, email, phone…"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full max-w-full"
          />
        )}
        toolbarActions={(
          <>
            <Button
              variant={showAnalytics ? 'secondary' : 'ghost'}
              size="sm"
              className="!px-2.5 whitespace-nowrap"
              onClick={() => setShowAnalytics(!showAnalytics)}
              title={showAnalytics ? 'Hide overview analytics' : 'Show overview analytics'}
            >
              <BarChart3 size={14} />
              Analytics
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="!px-2"
              onClick={handleRefresh}
              title="Refresh"
              data-mobile-primary
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </Button>
            <DataHubOpsMenu
              syncLabel={syncStatusLabel}
              onBackup={handleProductionBackup}
              onIncrementalSync={handleReconcile}
              onFullReconcile={handleFullReconcile}
              onImported={handleRefresh}
              backupPending={backupMutation.isPending}
              reconcilePending={reconcileMutation.isPending}
              reconcileEnabled={reconcileEnabled}
            />
          </>
        )}
      >
        {localDevMode && (
          <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
            {syncStatus?.message || 'Local dev — CRM/person data not synced. Data Hub is empty by design.'}
          </p>
        )}

        <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase -mt-1 mb-2">
          {activeFolderLabel} · {total.toLocaleString()} {total === 1 ? 'person' : 'people'}
        </p>

        <div data-density="compact" className="min-w-0">
          <DataTable
            columns={columns}
            data={peopleData?.data || []}
            isLoading={isLoading}
            onRowClick={(item) => setSelectedPersonId(item._id)}
            paginated
            serverSide
            totalItems={peopleData?.total || 0}
            totalPages={peopleData?.pages || 0}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            rowEstimateSize={56}
          />
        </div>
      </ListPageLayout>

      {selectedPersonId && (
        <Suspense fallback={null}>
          <DataHubPersonDetail
            contactId={selectedPersonId}
            onClose={() => setSelectedPersonId(null)}
          />
        </Suspense>
      )}
    </>
  );
}

export default function DataHubPage() {
  return <DataHubContent />;
}
