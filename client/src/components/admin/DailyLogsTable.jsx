import React, { useMemo, useState } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import { Card, DataTable, Badge, Input, NexusDropdown } from '../ui';
import { parseTimeSpentToMinutes as parseLogMinutes } from '../../utils/timeSpent';

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'time-desc', label: 'Most time logged' },
  { value: 'time-asc', label: 'Least time logged' },
  { value: 'title-asc', label: 'Title A–Z' },
  { value: 'project-asc', label: 'Project A–Z' },
];

export const DailyLogsTable = ({ entries = [], showMember = false }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [projectFilter, setProjectFilter] = useState('all');

  const projectOptions = useMemo(() => {
    const set = new Set(entries.map((e) => e.project || 'GENERAL').filter(Boolean));
    return [
      { value: 'all', label: 'All projects' },
      ...[...set].sort().map((p) => ({ value: p, label: p })),
    ];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let rows = [...entries];
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter((e) =>
        (e.title || '').toLowerCase().includes(term)
        || (e.message || '').toLowerCase().includes(term)
        || (e.project || '').toLowerCase().includes(term)
        || (e.userName || '').toLowerCase().includes(term)
      );
    }
    if (projectFilter !== 'all') {
      rows = rows.filter((e) => (e.project || 'GENERAL') === projectFilter);
    }
    rows.sort((a, b) => {
      const dateA = `${a.date} ${a.time}`;
      const dateB = `${b.date} ${b.time}`;
      switch (sortBy) {
        case 'date-asc': return dateA.localeCompare(dateB);
        case 'time-desc': return parseLogMinutes(b.timeSpent) - parseLogMinutes(a.timeSpent);
        case 'time-asc': return parseLogMinutes(a.timeSpent) - parseLogMinutes(b.timeSpent);
        case 'title-asc': return (a.title || '').localeCompare(b.title || '');
        case 'project-asc': return (a.project || '').localeCompare(b.project || '');
        default: return dateB.localeCompare(dateA);
      }
    });
    return rows;
  }, [entries, search, sortBy, projectFilter]);

  const columns = useMemo(() => {
    const cols = [
      {
        header: 'Date',
        render: (row) => (
          <span className="font-mono text-[11px] whitespace-nowrap">{row.date}</span>
        ),
      },
    ];
    if (showMember) {
      cols.push({
        header: 'Member',
        render: (row) => <span className="font-bold text-[11px]">{row.userName || '—'}</span>,
      });
    }
    cols.push(
      {
        header: 'Title',
        render: (row) => <span className="font-bold text-[11px]">{row.title}</span>,
      },
      {
        header: 'Project',
        render: (row) => (
          <Badge variant="info" className="!text-[8px]">{row.project || 'GENERAL'}</Badge>
        ),
      },
      {
        header: 'Time',
        render: (row) => (
          <span className="font-mono text-indigo-400 text-[11px] font-bold">{row.timeSpent || '—'}</span>
        ),
      },
      {
        header: 'Message',
        render: (row) => (
          <span className="text-[11px] text-[var(--color-text-muted)] max-w-xs truncate block">
            {row.message || '—'}
          </span>
        ),
      },
    );
    return cols;
  }, [showMember]);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
            <ArrowUpDown size={12} /> Daily Logs ({filteredEntries.length}
            {filteredEntries.length !== entries.length ? ` / ${entries.length}` : ''})
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            icon={Search}
            placeholder="Search title, project, message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!py-1.5 !text-xs"
          />
          <NexusDropdown
            variant="compact"
            options={projectOptions}
            value={projectFilter}
            onChange={setProjectFilter}
            placeholder="Project"
          />
          <NexusDropdown
            variant="compact"
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={setSortBy}
            placeholder="Sort"
          />
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="p-4 text-xs text-[var(--color-text-muted)] opacity-60">
          No daily log entries for this period.
        </p>
      ) : filteredEntries.length === 0 ? (
        <p className="p-4 text-xs text-[var(--color-text-muted)] opacity-60">
          No logs match your filters.
        </p>
      ) : (
        <DataTable
          className="!border-none !rounded-none"
          columns={columns}
          data={filteredEntries}
          defaultPageSize={10}
          paginated
          getRowId={(row) => `${row.date}|${row.time}|${row.title}|${row.userName || ''}`}
        />
      )}
    </Card>
  );
};

export default DailyLogsTable;
