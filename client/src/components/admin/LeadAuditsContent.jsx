import React, { useState } from 'react';
import axios from 'axios';
import { useLeadAudits } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { 
  History, Search, RefreshCw, Calendar, ArrowRight, User, FileText, Trash2
} from 'lucide-react';
import { Badge, Card, DataTable, Button, Input } from '../ui';
import { format } from 'date-fns';

const LeadAuditsContent = () => {
  const { user } = useAuth();
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

  // Client side filtering for extra responsiveness
  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      (log.leadId?.name || '').toLowerCase().includes(term) ||
      (log.userId?.name || '').toLowerCase().includes(term) ||
      (log.fieldChanged || '').toLowerCase().includes(term) ||
      (log.oldValue || '').toLowerCase().includes(term) ||
      (log.newValue || '').toLowerCase().includes(term)
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
      )
    },
    {
      header: 'User',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-center font-bold text-[9px]">
            {row.userId?.avatar ? (
              <img src={row.userId.avatar} className="w-full h-full rounded-full object-cover" alt="" />
            ) : (
              (row.userId?.name || 'SYS').substring(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--color-text-primary)]">
              {row.userId?.name || 'System / Batch'}
            </p>
            <p className="text-[8px] text-[var(--color-text-muted)] uppercase tracking-wider font-mono">
              {row.userRole || 'SYSTEM'}
            </p>
          </div>
        </div>
      )
    },
    {
      header: 'Lead Name',
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-bold text-[var(--color-text-primary)]">
            {row.leadId?.name || 'Purged / Unknown'}
          </span>
          {row.leadId?.phone && (
            <span className="text-[9px] font-mono text-[var(--color-text-muted)]">
              {row.leadId.phone}
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Field Changed',
      render: (row) => (
        <Badge variant="info" className="!text-[9px] font-mono uppercase">
          {row.fieldChanged}
        </Badge>
      )
    },
    {
      header: 'Modification Delta',
      render: (row) => (
        <div className="flex items-center gap-2 text-[10px] max-w-md truncate">
          <span className="text-[var(--color-text-muted)] line-through max-w-[150px] truncate block">
            {row.oldValue || '(empty)'}
          </span>
          <ArrowRight size={12} className="text-slate-500 shrink-0" />
          <span className="text-emerald-400 font-bold max-w-[150px] truncate block">
            {row.newValue || '(empty)'}
          </span>
        </div>
      )
    }
  ];

  const handlePurgeLogs = async () => {
    if (!window.confirm("Are you sure you want to permanently delete all lead change logs? This cannot be undone.")) {
      return;
    }
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
    <Card className="flex flex-col h-full !border-none">
      <div className="p-4 border-b border-[var(--color-bg-border)] flex flex-wrap items-center justify-between gap-4 bg-[var(--color-bg-secondary)]/50">
        <div className="flex items-center gap-2 max-w-xs flex-1">
          <Input 
            icon={Search} 
            placeholder="Search lead, user, field..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            className="!py-1 !text-[11px]"
          />
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <Button 
              variant="danger" 
              size="sm" 
              onClick={handlePurgeLogs} 
              disabled={purging}
              className="flex items-center gap-1.5 font-bold uppercase text-[9px] bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 size={12} className={purging ? 'animate-pulse' : ''} />
              Clear Audit Logs
            </Button>
          )}
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => refetch()} 
            disabled={isLoading || isFetching}
            className="flex items-center gap-1.5 font-bold uppercase text-[9px]"
          >
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-0">
        <DataTable 
          columns={columns} 
          data={filteredLogs} 
          className="!border-none"
          serverSide={true}
          totalItems={total}
          totalPages={pages}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
        {filteredLogs.length === 0 && !isLoading && (
          <div className="p-20 text-center opacity-30">
            <History size={48} className="mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">No lead change logs found</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default LeadAuditsContent;
