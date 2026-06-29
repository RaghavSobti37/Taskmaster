import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Plus, Layers } from 'lucide-react';
import {
  PageContainer, DataTable, Button, Badge,
} from '../../components/ui/primitives';
import SearchInput from '../../components/ui/SearchInput';
import NexusDropdown from '../../components/ui/NexusDropdown';
import QueryErrorBanner, { getQueryErrorMessage } from '../../components/ui/QueryErrorBanner';
import PageToolbar from '../../components/ui/PageToolbar';
import AdminConsoleBackButton, { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import {
  useOpsHubTaxonomy,
  useOpsHubEntities,
  useOpsHubWeekly,
  useOpsHubAnalytics,
  useOpsHubEntity,
  useCreateOpsEntity,
} from '../../hooks/queries/opsHub';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../contexts/AuthContext';
import { hasPageAccess } from '../../utils/pagePermissions';
import OpsMondayBoard from '../../components/opsHub/OpsMondayBoard';
import OpsHubAnalyticsPanel from '../../components/opsHub/OpsHubAnalyticsPanel';
import OpsEntityDetail from '../../components/opsHub/OpsEntityDetail';
import { OpsCsvImportButton } from '../../components/opsHub/OpsLinksWidget';
import { useToast } from '../../contexts/ToastContext';

const DOMAIN_PERMISSION = {
  academy: 'ops_hub_academy',
  media: 'ops_hub_media',
  show_booking: 'ops_hub_show_booking',
  influencers: 'ops_hub_influencers',
};

function canWriteDomain(user, domain) {
  if (hasPageAccess(user, 'admin_ops_hub')) return true;
  const key = DOMAIN_PERMISSION[domain];
  return key ? hasPageAccess(user, key) : false;
}

export default function OpsHubPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeDomain, setActiveDomain] = useState(searchParams.get('domain') || 'all');
  const [subtype, setSubtype] = useState(searchParams.get('subtype') || '');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedId, setSelectedId] = useState(searchParams.get('entity') || null);

  const { data: taxonomy } = useOpsHubTaxonomy();
  const domains = taxonomy?.domains || [];
  const statuses = taxonomy?.statuses || [];

  const listParams = useMemo(() => ({
    domain: activeDomain,
    subtype: subtype || undefined,
    status: status || undefined,
    q: debouncedSearch || undefined,
    page,
    limit: 25,
  }), [activeDomain, subtype, status, debouncedSearch, page]);

  const entitiesQuery = useOpsHubEntities(listParams);
  const weeklyQuery = useOpsHubWeekly();
  const analyticsQuery = useOpsHubAnalytics(weeklyQuery.data?.weekKey, showAnalytics);
  const entityQuery = useOpsHubEntity(selectedId);
  const createMutation = useCreateOpsEntity();

  const weekKey = weeklyQuery.data?.weekKey;
  const activeDomainMeta = domains.find((d) => d.key === activeDomain);
  const subtypeOptions = useMemo(() => [
    { value: '', label: 'All subtypes' },
    ...(activeDomainMeta?.subtypes || []).map((s) => ({ value: s.key, label: s.label })),
  ], [activeDomainMeta]);
  const statusOptions = useMemo(() => [
    { value: '', label: 'All statuses' },
    ...statuses.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
  ], [statuses]);

  useEffect(() => {
    if (searchParams.get('entity') && searchParams.get('entity') !== selectedId) {
      setSelectedId(searchParams.get('entity'));
    }
  }, [searchParams, selectedId]);

  const openEntity = (id) => {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.set('entity', id);
    setSearchParams(next, { replace: true });
  };

  const closeEntity = () => {
    setSelectedId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('entity');
    setSearchParams(next, { replace: true });
  };

  const handleCreate = async () => {
    const domain = activeDomain === 'all' ? domains[0]?.key : activeDomain;
    if (!domain) return;
    const firstSubtype = domains.find((d) => d.key === domain)?.subtypes?.[0]?.key;
    if (!canWriteDomain(user, domain)) {
      toast.error('No write access for this domain');
      return;
    }
    try {
      const created = await createMutation.mutateAsync({
        domain,
        subtype: firstSubtype,
        name: 'New contact',
        status: 'new',
      });
      openEntity(created._id);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const columns = [
    {
      header: 'Name',
      render: (row) => (
        <div>
          <p className="text-xs font-bold">{row.name}</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">{row.organization || row.city || '—'}</p>
        </div>
      ),
    },
    {
      header: 'Domain',
      render: (row) => <Badge variant="info" className="!text-[9px]">{row.domain}</Badge>,
    },
    {
      header: 'Subtype',
      render: (row) => <span className="text-[10px] text-[var(--color-text-muted)]">{row.subtype}</span>,
    },
    {
      header: 'Status',
      render: (row) => <Badge variant="mint">{row.status}</Badge>,
    },
    {
      header: 'Owner',
      render: (row) => <span className="text-[10px]">{row.assigneeId?.name || '—'}</span>,
    },
    {
      header: 'Updated',
      render: (row) => (
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {row.lastWeeklyTouchAt ? formatDisplayDate(new Date(row.lastWeeklyTouchAt)) : '—'}
        </span>
      ),
    },
  ];

  const selected = entityQuery.data || entitiesQuery.data?.items?.find((i) => i._id === selectedId);
  const writeDomain = selected?.domain || (activeDomain !== 'all' ? activeDomain : null);

  return (
    <PageContainer>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AdminConsoleBackButton to={ADMIN_CONSOLE_PATH} />
            <div className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-atomic)] bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]">
              <Layers size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Ops Hub</h1>
              <p className="text-xs text-[var(--color-text-muted)]">Weekly ops directory — Academy, Media, Show Booking, Influencers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={showAnalytics ? 'primary' : 'secondary'} onClick={() => setShowAnalytics((v) => !v)}>
              <BarChart3 size={14} className="mr-1" />
              Analytics
            </Button>
            <OpsCsvImportButton
              domain={activeDomain !== 'all' ? activeDomain : domains[0]?.key}
              subtype={subtype || activeDomainMeta?.subtypes?.[0]?.key}
              disabled={activeDomain === 'all' && !subtype}
            />
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
              <Plus size={14} className="mr-1" />
              Add
            </Button>
          </div>
        </div>

        <QueryErrorBanner error={entitiesQuery.error} message={getQueryErrorMessage(entitiesQuery.error)} />

        {showAnalytics && <OpsHubAnalyticsPanel analytics={analyticsQuery.data} />}

        {weekKey && (
          <OpsMondayBoard
            weekKey={weekKey}
            sections={weeklyQuery.data?.sections || []}
            domains={domains}
            canSubmitDomain={(d) => canWriteDomain(user, d)}
          />
        )}

        <div className="flex flex-col lg:flex-row gap-4">
          <aside className="lg:w-48 shrink-0 space-y-1">
            <button
              type="button"
              onClick={() => { setActiveDomain('all'); setSubtype(''); setPage(1); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold ${activeDomain === 'all' ? 'bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]' : 'hover:bg-[var(--token-surface-2)]'}`}
            >
              All domains
            </button>
            {domains.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => { setActiveDomain(d.key); setSubtype(''); setPage(1); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold border-l-2 ${activeDomain === d.key ? 'bg-[var(--token-surface-2)]' : 'border-transparent hover:bg-[var(--token-surface-2)]'}`}
                style={{ borderLeftColor: activeDomain === d.key ? d.color : 'transparent' }}
              >
                {d.label}
              </button>
            ))}
          </aside>

          <div className="flex-1 min-w-0 space-y-3">
            <PageToolbar>
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search ops records…" className="max-w-xs" />
              <NexusDropdown value={subtype} options={subtypeOptions} onChange={(v) => { setSubtype(v); setPage(1); }} placeholder="Subtype" />
              <NexusDropdown value={status} options={statusOptions} onChange={(v) => { setStatus(v); setPage(1); }} placeholder="Status" />
            </PageToolbar>

            <DataTable
              columns={columns}
              data={entitiesQuery.data?.items || []}
              loading={entitiesQuery.isLoading}
              onRowClick={(row) => openEntity(row._id)}
              pagination={{
                page,
                pageSize: 25,
                total: entitiesQuery.data?.total || 0,
                onPageChange: setPage,
              }}
            />
          </div>
        </div>
      </div>

      <OpsEntityDetail
        entity={selected}
        open={!!selectedId && !!selected}
        onClose={closeEntity}
        domains={domains}
        canEdit={writeDomain ? canWriteDomain(user, writeDomain) : false}
        onSaved={() => entitiesQuery.refetch()}
      />
    </PageContainer>
  );
}
