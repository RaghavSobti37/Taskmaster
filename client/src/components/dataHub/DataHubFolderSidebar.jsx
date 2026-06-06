import React, { useState } from 'react';
import {
  Database, ShoppingBag, Users, Sheet, Phone, MessageSquare,
  UserX, Mail, UsersRound, Activity, Star, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Badge } from '../ui';

const ICONS = {
  all: Database,
  exly: ShoppingBag,
  leads: Users,
  outsourced: Sheet,
  newsletter: Mail,
  tsc: Sheet,
  booked_calls: Phone,
  enquiries: MessageSquare,
  unsubscribed: UserX,
  mail: Mail,
  community: UsersRound,
  active: Activity,
  loyal: Star,
};

export default function DataHubFolderSidebar({ folders = [], activeFolder, onSelect, tscSubFilter, onTscSubFilter }) {
  const [tscExpanded, setTscExpanded] = useState(true);

  const renderFolder = (folder) => {
    const Icon = ICONS[folder.key] || Database;
    const isActive = activeFolder === folder.key && !tscSubFilter;
    const isLoyal = folder.key === 'loyal';

    return (
      <button
        key={folder.key}
        type="button"
        onClick={() => {
          onTscSubFilter?.(null);
          onSelect(folder.key);
        }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
          isActive
            ? 'bg-[var(--color-action-primary)]/15 text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/30'
            : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]'
        } ${isLoyal ? 'mt-2 border-t border-[var(--color-bg-border)] pt-3' : ''}`}
      >
        <Icon size={14} className={isLoyal ? 'text-amber-400' : ''} />
        <span className="text-[10px] font-black uppercase tracking-wide flex-1 truncate">{folder.label}</span>
        <Badge variant={isActive ? 'info' : 'neutral'}>{folder.count ?? 0}</Badge>
      </button>
    );
  };

  const outFolder = folders.find((f) => f.key === 'outsourced' || f.key === 'tsc');
  const otherFolders = folders.filter((f) => f.key !== 'outsourced' && f.key !== 'tsc');

  return (
    <div className="w-56 shrink-0 border-r border-[var(--color-bg-border)] pr-3 space-y-1">
      <h3 className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] px-3 mb-2">Data Folders</h3>
      {otherFolders.map(renderFolder)}

      {outFolder && (
        <div>
          <button
            type="button"
            onClick={() => setTscExpanded(!tscExpanded)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-bg-secondary)]"
          >
            {tscExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Sheet size={14} />
            <span className="text-[10px] font-black uppercase flex-1 text-left">{outFolder.label}</span>
            <Badge variant="neutral">{outFolder.count ?? 0}</Badge>
          </button>
          {tscExpanded && outFolder.children?.length > 0 && (
            <div className="ml-4 space-y-0.5 max-h-48 overflow-y-auto">
              <button
                type="button"
                onClick={() => { onTscSubFilter?.(null); onSelect('outsourced'); }}
                className={`w-full text-left px-2 py-1 text-[9px] font-bold uppercase rounded ${
                  (activeFolder === 'outsourced' || activeFolder === 'tsc') && !tscSubFilter ? 'text-[var(--color-action-primary)]' : 'text-[var(--color-text-muted)]'
                }`}
              >
                All Outsourced
              </button>
              {outFolder.children.map((child) => {
                const filterKey = child.filter?.campaign
                  ? `campaign:${child.filter.campaign}`
                  : `source:${child.filter?.originSource}`;
                const isSubActive = tscSubFilter === filterKey;
                return (
                  <button
                    key={child.key}
                    type="button"
                    onClick={() => {
                      onSelect('outsourced');
                      onTscSubFilter?.(filterKey, child.filter);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded text-[9px] font-bold uppercase truncate ${
                      isSubActive ? 'bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <span className="truncate">{child.label}</span>
                    <span className="ml-1 opacity-60">{child.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
