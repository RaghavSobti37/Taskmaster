import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Activity, BarChart3, Radio } from 'lucide-react';
import { Badge, Button, PageSkeleton } from '../../components/ui';
import { useSystemLogs, useTopPages } from '../../hooks/useSystemLogs';
import { SEVERITY } from '../../lib/systemLogContract';
import SystemLogSandbox from '../../components/admin/SystemLogSandbox';
import OpsTerminalView from '../../components/admin/OpsTerminalView';

const SEVERITY_VARIANT = {
  [SEVERITY.ERROR]: 'danger',
  [SEVERITY.WARN]: 'warning',
  [SEVERITY.SUCCESS]: 'success',
  [SEVERITY.INFO]: 'info',
};

const formatActorLabel = (log) => {
  if (!log.actorId || log.actorId === 'SYSTEM') return null;
  if (log.actorName) return log.actorName;
  if (log.actorId === 'ANON') return 'Anonymous';
  return null;
};

const LogFeedItem = ({ log }) => {
  const actorLabel = formatActorLabel(log);

  return (
    <div className="py-3 border-b border-[var(--color-bg-border)] last:border-0 space-y-1.5">
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <div className="p-1.5 bg-[var(--color-action-primary)]/10 rounded-[var(--radius-atomic)] text-[var(--color-action-primary)] shrink-0">
            <Activity size={12} />
          </div>
          <Badge variant={SEVERITY_VARIANT[log.severity] || 'default'}>{log.severity}</Badge>
          {log.module && <Badge variant="outline">{log.module}</Badge>}
          <span className="text-xs font-semibold tm-data-primary truncate">
            {log.message}
          </span>
        </div>
        <span className="text-[9px] font-mono tm-data-meta shrink-0 tabular-nums">
          {format(new Date(log.timestamp), 'HH:mm:ss')}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] tm-data-meta font-mono pl-9">
        {log.route && <span>{log.method || '—'} {log.route}</span>}
        {actorLabel && <span>{actorLabel}</span>}
        {log.errorCode && log.errorCode !== 'PAGE_VIEW' && <span>{log.errorCode}</span>}
      </div>
    </div>
  );
};

const TopPagesCard = ({ pages = [], isLoading }) => (
  <div className="p-4 border border-[var(--color-bg-border)] space-y-3">
    <div className="flex items-center gap-2 tm-widget-label">
      <BarChart3 className="w-4 h-4" />
      Top pages · 7 days
    </div>
    {isLoading && <PageSkeleton />}
    {!isLoading && pages.length === 0 && (
      <p className="text-xs tm-data-meta">No page visits recorded yet. Browse the app to populate.</p>
    )}
    <ul className="space-y-2">
      {pages.map((row, i) => (
        <li key={row?.path} className="flex items-center justify-between gap-2 text-sm border-b border-[var(--color-bg-border)] pb-2 last:border-0">
          <span className="truncate tm-data-primary font-medium">
            <span className="tm-data-meta mr-2 tabular-nums">{i + 1}.</span>
            {row?.path}
          </span>
          <span className="shrink-0 text-[10px] font-mono tm-data-meta tabular-nums">
            {row?.count} · {row?.uniqueUsers} users
          </span>
        </li>
      ))}
    </ul>
  </div>
);

const SystemLogsPanel = ({ severityFilter = '', search = '' }) => {
  const filters = useMemo(
    () => ({
      severity: severityFilter || undefined,
      search: search || undefined,
      excludePageViews: true,
      limit: 100,
      page: 1,
    }),
    [severityFilter, search]
  );

  const { data, isLoading, refetch, isFetching } = useSystemLogs(filters);
  const { data: topPagesData, isLoading: topLoading } = useTopPages(7);
  const logs = data?.logs || [];

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <Radio className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-pulse' : ''}`} />
          Refresh
        </Button>
        <span className="text-xs tm-data-meta ml-auto tabular-nums">
          {data?.pagination?.total ?? logs.length} events · all users
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <TopPagesCard pages={topPagesData?.pages || []} isLoading={topLoading} />
        </div>

        <div className="lg:col-span-2 border border-[var(--color-bg-border)] min-h-[480px] flex flex-col bg-[var(--color-bg-workspace)] font-mono">
          <div className="px-4 py-2.5 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-surface)]">
            <span className="tm-widget-label font-mono text-[10px] uppercase tracking-widest">
              ops-terminal · global activity
            </span>
            <span className="text-[9px] font-mono text-emerald-500 animate-pulse">● live</span>
          </div>
          <div className="px-3 py-2 flex-1 max-h-[70vh] overflow-y-auto">
            <OpsTerminalView logs={logs} />
          </div>
        </div>
      </div>

      <SystemLogSandbox />
    </div>
  );
};

export { SystemLogsPanel as SystemLogsContent };
