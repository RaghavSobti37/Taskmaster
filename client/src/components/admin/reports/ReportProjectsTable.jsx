import React, { useMemo, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { Card, Badge, ProgressBar, TablePagination } from '../../ui';
import { getWorkspaceColor } from '../../../utils/workspaceColors';

const STATUS_VARIANT = {
  active: 'info',
  completed: 'success',
  archived: 'slate',
  on_hold: 'warning',
};

const PAGE_SIZE = 5;

const ReportProjectsTable = ({ items = [], workspaces = [] }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const workspaceGroups = useMemo(() => {
    const map = new Map();
    items.forEach((project) => {
      const raw = (project.workspace || 'General').trim();
      const key = raw.toUpperCase();
      if (!map.has(key)) {
        map.set(key, { name: raw, projects: [] });
      }
      map.get(key).projects.push(project);
    });
    return [...map.values()]
      .map((g) => ({
        ...g,
        color: getWorkspaceColor(g.name, workspaces),
        projects: g.projects.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
      }))
      .sort((a, b) => {
        if (a.name.toUpperCase() === 'GENERAL') return 1;
        if (b.name.toUpperCase() === 'GENERAL') return -1;
        return a.name.localeCompare(b.name);
      });
  }, [items, workspaces]);

  const totalProjects = items.length;
  const totalPages = Math.max(1, Math.ceil(workspaceGroups.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageGroups = workspaceGroups.slice(start, start + pageSize);

  if (!items.length) {
    return (
      <Card className="p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
          Projects (0)
        </p>
        <p className="text-xs text-[var(--color-text-muted)] opacity-60">No projects for this period.</p>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
          <Briefcase size={12} /> Projects ({totalProjects})
        </p>
        <Badge variant="slate">{workspaceGroups.length} workspaces</Badge>
      </div>

      <div className="divide-y divide-[var(--color-bg-border)]">
        {pageGroups.map((group) => (
          <div key={group.name} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
              <h4 className="text-xs font-black uppercase tracking-tight text-[var(--color-text-primary)]">
                {group.name}
              </h4>
              <Badge variant="info" className="!text-[8px] !py-0">
                {group.projects.length}
              </Badge>
            </div>
            <div className="space-y-2 pl-4 border-l-2" style={{ borderColor: `${group.color}55` }}>
              {group.projects.map((project, idx) => {
                const status = (project.status || 'active').toLowerCase();
                const variant = STATUS_VARIANT[status] || 'info';
                const progress = project.progress || 0;
                return (
                  <div
                    key={`${group.name}-${project.name}-${idx}`}
                    className="p-3 rounded-xl bg-[var(--color-bg-secondary)]/50 border border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)]/20 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">{project.name}</span>
                      <Badge variant={variant} className="!text-[8px] uppercase">
                        {status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                      <span>Progress</span>
                      <span style={{ color: group.color }}>{progress}%</span>
                    </div>
                    <ProgressBar progress={progress} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {workspaceGroups.length > 1 && (
        <TablePagination
          pageSize={pageSize}
          currentPage={page}
          totalPages={totalPages}
          totalItems={workspaceGroups.length}
          rowCount={pageGroups.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      )}
    </Card>
  );
};

export default ReportProjectsTable;
