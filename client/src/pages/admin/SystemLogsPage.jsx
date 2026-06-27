import React, { useState, useMemo } from 'react';
import { ScrollText, Search, AlertTriangle, AlertCircle, Activity } from 'lucide-react';
import { ListPageLayout, Input, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import { SystemLogsContent } from './SystemLogsPanel';
import { SEVERITY_VALUES, SEVERITY } from '../../lib/systemLogContract';
import { useSystemLogs } from '../../hooks/useSystemLogs';

const SystemLogsPage = () => {
  const [severityFilter, setSeverityFilter] = useState('');
  const [search, setSearch] = useState('');
  const { data: logData, isError, error, refetch } = useSystemLogs({ limit: 200, excludePageViews: true });

  const logStats = useMemo(() => {
    const logs = logData?.logs || [];
    return {
      total: logs.length,
      errors: logs.filter((l) => l.severity === SEVERITY.ERROR).length,
      warns: logs.filter((l) => l.severity === SEVERITY.WARN).length,
    };
  }, [logData]);

  return (
    <ListPageLayout
      containerClassName="!py-4 ops-terminal-page"
      overview={{
        stats: [
          {
            id: 'loaded',
            label: 'Recent Logs',
            value: logStats.total,
            icon: Activity,
            variant: 'info',
            info: 'Entries loaded in the current feed (latest 200, excluding page views).',
          },
          {
            id: 'errors',
            label: 'Errors',
            value: logStats.errors,
            icon: AlertCircle,
            variant: 'rose',
            info: 'ERROR severity entries in the loaded window.',
          },
          {
            id: 'warns',
            label: 'Warnings',
            value: logStats.warns,
            icon: AlertTriangle,
            variant: 'apricot',
            info: 'WARN severity entries in the loaded window.',
          },
        ],
      }}
      toolbar={
        <>
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
            className="text-sm rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] px-3 py-1.5 h-9 shrink-0"
          >
            <option value="">All severities</option>
            {SEVERITY_VALUES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </>
      }
    >
      {isError && (
        <QueryErrorBanner
          className="mb-4"
          message={getQueryErrorMessage(error, 'Failed to load system logs')}
          onRetry={() => refetch()}
        />
      )}
      <SystemLogsContent severityFilter={severityFilter} search={search} />
    </ListPageLayout>
  );
};

export default SystemLogsPage;
