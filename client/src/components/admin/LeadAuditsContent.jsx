import React, { useState } from 'react';
import axios from 'axios';
import { useLeadAudits } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import {
  History, Search, RefreshCw, Calendar, ArrowRight, Trash2,
} from 'lucide-react';
import { Badge, DataTable, Button, Input, UserLabel } from '../ui';
import { useConfirm } from '../../contexts/confirmContext';
import { format } from 'date-fns';

function LeadAuditMobileCard({ row }) {
  const timestamp = row.timestamp
    ? format(new Date(row.timestamp), 'dd-MM-yyyy HH:mm:ss')
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
        <div className="flex items-center gap-1.5 text-[11px] min-w-0">
          <span className="text-[var(--color-text-muted)] line-through truncate min-w-0 flex-1">
            {row.oldValue || '(empty)'}
          </span>
          <ArrowRight size={12} className="text-slate-500 shrink-0" />
          <span className="text-emerald-400 font-bold truncate min-w-0 flex-1 text-right">
            {row.newValue || '(empty)'}
          </span>
        </div>
      </div>
    </div>
  );
}

const LeadAuditsContent = () => {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [purging, setPurging] = useState(false);

  const { data, isLoading, refetch, isFetching } = useLeadAudits({
    page,
    limit: pageSize,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

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
            {row.timestamp ? format(new Date(row.timestamp), 'dd-MM-yyyy HH:mm:ss') : 'N/A'}
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
        <div className="flex items-center gap-2 text-[10px] max-w-md min-w-0">
          <span className="text-[var(--color-text-muted)] line-through truncate min-w-0 flex-1">
            {row.oldValue || '(empty)'}
          </span>
          <ArrowRight size={12} className="text-slate-500 shrink-0" />
          <span className="text-emerald-400 font-bold truncate min-w-0 flex-1">
            {row.newValue || '(empty)'}
          </span>
        </div>
      ),
    },
  ];

  const handlePurgeLogs = async () => {
    const ok = await confirm({
      title: 'Delete all logs?',
      message: 'Are you sure you want to permanently delete all lead change logs? This cannot be undone.',
      confirmLabel: 'Delete all',
      type: 'danger',
    });
    if (!ok) return;
    try {
      setPurging(true);
      await axios.delete('/api/crm/leads/audit-logs/purge');
      refetch();
    } catch (err) {
      console.error('Failed to purge logs:', err);
      alert(err.response?.data?.error || 'Failed to clear logs.');
    } finally {
      setPurging(false);
    }
  };

  return (
    <section className="flex flex-col h-full border-t border-[var(--color-bg-border)]">
      <div className="p-3 sm:p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="w-full sm:flex-1 sm:max-w-xs min-w-0">
            <Input
              icon={Search}
              placeholder="Search lead, user, field..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="!py-1.5 !text-sm w-full"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isAdminUser(user) && (
              <Button
                variant="danger"
                size="sm"
                onClick={handlePurgeLogs}
                disabled={purging}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 font-bold uppercase text-[10px] bg-red-600 hover:bg-red-700 text-white min-h-[40px]"
              >
                <Trash2 size={12} className={purging ? 'animate-pulse' : ''} />
                <span className="truncate">Clear logs</span>
              </Button>
            )}
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
          <div className="p-16 sm:p-20 text-center opacity-30">
            <History size={48} className="mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">No lead change logs found</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default LeadAuditsContent;
