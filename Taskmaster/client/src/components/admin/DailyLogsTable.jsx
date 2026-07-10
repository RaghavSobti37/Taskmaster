import React, { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { DataTable, Badge, NexusDropdown, UserLabel, SearchInput, EmptyState } from '../ui';
import { parseTimeSpentToMinutes as parseLogMinutes } from '../../utils/timeSpent';

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'time-desc', label: 'Most time logged' },
  { value: 'time-asc', label: 'Least time logged' },
  { value: 'title-asc', label: 'Title A–Z' },
  { value: 'project-asc', label: 'Project A–Z' },
];

const DailyLogsTable = ({ entries = [], showMember = false }) => {
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
        render: (row) => (
          <UserLabel
            name={row.userName || '—'}
            avatar={row.userAvatar}
            size="xs"
            nameClassName="font-bold text-[11px]"
          />
        ),
      });
    }
    cols.push(
      {
        header: 'Title',
        render: (row) => (
          <span className="font-bold text-[11px] inline-flex items-center gap-1.5">
            {row.title}
            {row.duplicateCollapsed && (
              <Badge variant="warning" className="!text-[7px] uppercase">deduped</Badge>
            )}
          </span>
        ),
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
    <section className="border-t border-[var(--color-bg-border)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
            <ArrowUpDown size={12} /> Daily Logs ({filteredEntries.length}
            {filteredEntries.length !== entries.length ? ` / ${entries.length}` : ''})
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <SearchInput
            variant="toolbar"
            placeholder="Search title, project, message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!w-full"
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
        <EmptyState
          title="No daily log entries for this period"
          variant="subtle"
          className="py-4"
        />
      ) : filteredEntries.length === 0 ? (
        <EmptyState
          title="No logs match your filters"
          variant="subtle"
          className="py-4"
        />
      ) : (
        <DataTable
          className="!border-none !rounded-none"
          columns={columns}
          data={filteredEntries}
          paginated
          getRowId={(row) => `${row.date}|${row.time}|${row.title}|${row.userName || ''}`}
        />
      )}
    </section>
  );
};

export default DailyLogsTable;
