import React, { useMemo, useState } from 'react';
import { useLeadAudits } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import {
  History, Calendar, RefreshCw, Database, Users, Clock,
} from 'lucide-react';
import {
  Badge,
  DataTable,
  Button,
  SearchInput,
  UserLabel,
  EmptyState,
  DataOverviewSection,
  ValueChange,
} from '../ui';
import { formatDisplayDateTimeSeconds } from '../../utils/dateDisplay';
import { isSameDay, startOfDay } from 'date-fns';

function LeadAuditMobileCard({ row }) {
  const timestamp = row.timestamp
    ? formatDisplayDateTimeSeconds(new Date(row.timestamp))
    : 'N/A';

  return (
    <div className="space-y-2.5 w-full">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 text-[11px] font-mono text-[var(--color-text-secondary)]">
          <Calendar size={12} className="text-[var(--color-text-muted)] shrink-0" />
          <span className="truncate">{timestamp}</span>
        </div>
        <Badge variant="info" className="!text-[9px] font-mono uppercase shrink-0 max-w-[45%] truncate">
          {row.fieldChanged}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 min-w-0">
        <div className="min-w-0">
          <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">User</p>
          <UserLabel
            user={row.userId}
            name={row.userId?.name || 'System'}
            size="xs"
            subtitle={row.userRole || 'SYSTEM'}
            nameClassName="text-[11px] font-bold"
          />
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Lead</p>
          <p className="text-[11px] font-bold text-[var(--color-text-primary)] truncate">
            {row.leadId?.name || 'Unknown'}
          </p>
          {row.leadId?.phone && (
            <p className="text-[10px] font-mono text-[var(--color-text-muted)] truncate">{row.leadId.phone}</p>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-[var(--color-bg-secondary)]/60 border border-[var(--color-bg-border)] px-2.5 py-2 min-w-0">
        <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Change</p>
        <ValueChange oldValue={row.oldValue} newValue={row.newValue} size="md" />
      </div>
    </div>
  );
}

const LeadAuditsContent = () => {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, refetch, isFetching } = useLeadAudits({
    page,
    limit: pageSize,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const statsLimit = Math.min(Math.max(total, 1), 2000);
  const { data: statsData, isLoading: statsLoading } = useLeadAudits(
    { page: 1, limit: statsLimit },
    total > 0,
  );

  const overviewStats = useMemo(() => {
    const batch = statsData?.logs || [];
    const todayStart = startOfDay(new Date());
    const entriesToday = batch.filter(
      (log) => log.timestamp && isSameDay(new Date(log.timestamp), todayStart),
    ).length;
    const activeUsers = new Set(
      batch.map((log) => {
        const id = log.userId?._id || log.userId;
        return id ? String(id) : null;
      }).filter(Boolean),
    ).size;

    return [
      {
        id: 'total',
        label: 'Total entries',
        value: total.toLocaleString(),
        icon: Database,
        variant: 'info',
        info: 'All lead field changes recorded in the audit log.',
      },
      {
        id: 'today',
        label: 'Entries today',
        value: statsLoading ? '—' : entriesToday.toLocaleString(),
        icon: Clock,
        variant: 'mint',
        info: 'Changes logged since midnight (local time).',
      },
      {
        id: 'users',
        label: 'Active users',
        value: statsLoading ? '—' : activeUsers.toLocaleString(),
        icon: Users,
        variant: 'slate',
        info: 'Distinct users with changes in the loaded audit window.',
      },
    ];
  }, [total, statsData?.logs, statsLoading]);

  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      (log.leadId?.name || '').toLowerCase().includes(term)
      || (log.userId?.name || '').toLowerCase().includes(term)
      || (log.fieldChanged || '').toLowerCase().includes(term)
      || (log.oldValue || '').toLowerCase().includes(term)
      || (log.newValue || '').toLowerCase().includes(term)
    );
  });

  const columns = [
    {
      header: 'Time',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Calendar size={12} className="text-[var(--color-text-muted)]" />
          <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">
            {row.timestamp ? formatDisplayDateTimeSeconds(new Date(row.timestamp)) : 'N/A'}
          </span>
        </div>
      ),
    },
    {
      header: 'User',
      render: (row) => (
        <UserLabel
          user={row.userId}
          name={row.userId?.name || 'System / Batch'}
          size="xs"
          subtitle={row.userRole || 'SYSTEM'}
          nameClassName="text-[10px] font-bold text-[var(--color-text-primary)]"
        />
      ),
    },
    {
      header: 'Lead Name',
      render: (row) => (
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-[var(--color-text-primary)] truncate">
            {row.leadId?.name || 'Purged / Unknown'}
          </span>
          {row.leadId?.phone && (
            <span className="text-[9px] font-mono text-[var(--color-text-muted)] truncate">
              {row.leadId.phone}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Field Changed',
      render: (row) => (
        <Badge variant="info" className="!text-[9px] font-mono uppercase">
          {row.fieldChanged}
        </Badge>
      ),
    },
    {
      header: 'Modification Delta',
      mobileFullWidth: true,
      render: (row) => (
        <ValueChange oldValue={row.oldValue} newValue={row.newValue} />
      ),
    },
  ];

  return (
    <section className="flex flex-col h-full border-t border-[var(--color-bg-border)]">
      <div className="p-3 sm:p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/30">
        <DataOverviewSection stats={overviewStats} mobileMaxStats={3} />
      </div>

      <div className="p-3 sm:p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="w-full sm:flex-1 sm:max-w-xs min-w-0">
            <SearchInput
              variant="toolbar"
              placeholder="Search lead, user, field..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="!w-full"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading || isFetching}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 font-bold uppercase text-[10px] min-h-[40px]"
            >
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="p-0 min-w-0">
        <DataTable
          columns={columns}
          data={filteredLogs}
          isLoading={isLoading}
          className="!border-none"
          serverSide
          totalItems={total}
          totalPages={pages}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          mobileRowRender={(row) => <LeadAuditMobileCard row={row} />}
        />
        {filteredLogs.length === 0 && !isLoading && (
          <EmptyState
            icon={History}
            title="No lead change logs found"
            variant="subtle"
            className="opacity-80"
          />
        )}
      </div>
    </section>
  );
};

export default LeadAuditsContent;
