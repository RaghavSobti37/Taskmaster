import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Activity, BarChart3, Radio, Search } from 'lucide-react';
import { Badge, Button, Card, Input, PageSkeleton } from '../../components/ui';
import { useSystemLogs, useTopPages } from '../../hooks/useSystemLogs';
import { SEVERITY, SEVERITY_VALUES } from '../../lib/systemLogContract';
import SystemLogSandbox from '../../components/admin/SystemLogSandbox';

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
    <div className="p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl space-y-1.5">
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500 shrink-0">
            <Activity size={12} />
          </div>
          <Badge variant={SEVERITY_VARIANT[log.severity] || 'default'}>{log.severity}</Badge>
          {log.module && <Badge variant="outline">{log.module}</Badge>}
          <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
            {log.message}
          </span>
        </div>
        <span className="text-[9px] font-mono text-[var(--color-text-muted)] shrink-0">
          {format(new Date(log.timestamp), 'HH:mm:ss')}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--color-text-muted)] font-mono pl-9">
        {log.route && <span>{log.method || '—'} {log.route}</span>}
        {actorLabel && <span>{actorLabel}</span>}
        {log.errorCode && log.errorCode !== 'PAGE_VIEW' && <span>{log.errorCode}</span>}
      </div>
    </div>
  );
};

const TopPagesCard = ({ pages = [], isLoading }) => (
  <Card className="p-4 space-y-3">
    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">
      <BarChart3 className="w-4 h-4" />
      Top pages · 7 days
    </div>
    {isLoading && <PageSkeleton />}
    {!isLoading && pages.length === 0 && (
      <p className="text-xs text-[var(--color-text-muted)]">No page visits recorded yet. Browse the app to populate.</p>
    )}
    <ul className="space-y-2">
      {pages.map((row, i) => (
        <li key={row.path} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-[var(--color-text-primary)] font-medium">
            <span className="text-[var(--color-text-muted)] mr-2">{i + 1}.</span>
            {row.path}
          </span>
          <span className="shrink-0 text-[10px] font-mono text-[var(--color-text-muted)]">
            {row.count} · {row.uniqueUsers} users
          </span>
        </li>
      ))}
    </ul>
  </Card>
);

const SystemLogsPanel = () => {
  const [severityFilter, setSeverityFilter] = useState('');
  const [search, setSearch] = useState('');

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
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs…"
            className="pl-9 h-9 text-sm"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="text-sm rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] px-3 py-1.5 h-9"
        >
          <option value="">All severities</option>
          {SEVERITY_VALUES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <Radio className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-pulse' : ''}`} />
          Refresh
        </Button>
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">
          {data?.pagination?.total ?? logs.length} events · all users
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <TopPagesCard pages={topPagesData?.pages || []} isLoading={topLoading} />
        </div>

        <Card className="lg:col-span-2 !p-0 overflow-hidden min-h-[480px]">
          <div className="px-4 py-2.5 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              Global activity
            </span>
            <span className="text-[9px] font-mono text-emerald-500">live</span>
          </div>
          <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
            {logs.length === 0 && (
              <div className="py-16 text-center opacity-40">
                <Activity size={28} className="mx-auto mb-2" />
                <p className="text-xs font-semibold uppercase">No events yet</p>
              </div>
            )}
            {logs.map((log) => (
              <LogFeedItem key={log._id} log={log} />
            ))}
          </div>
        </Card>
      </div>

      <SystemLogSandbox />
    </div>
  );
};

export default SystemLogsPanel;
export { SystemLogsPanel as SystemLogsContent };
