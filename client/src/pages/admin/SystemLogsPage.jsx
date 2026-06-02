import React, { useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { ListPageLayout, Input } from '../../components/ui';
import { SystemLogsContent } from './SystemLogsPanel';
import { SEVERITY_VALUES } from '../../lib/systemLogContract';

const SystemLogsPage = () => {
  const [severityFilter, setSeverityFilter] = useState('');
  const [search, setSearch] = useState('');

  return (
    <ListPageLayout
      containerClassName="!py-4"
      icon={ScrollText}
      title="System Logs"
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
      <SystemLogsContent severityFilter={severityFilter} search={search} />
    </ListPageLayout>
  );
};

export default SystemLogsPage;
