import React from 'react';
import {
  Database, ShoppingBag, Users, Sheet, Phone, MessageSquare,
  UserX, Mail, UsersRound, Activity, Star,
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

export default function DataHubFolderSidebar({ folders = [], activeFolder, onSelect }) {
  return (
    <div className="w-56 shrink-0 border-r border-[var(--color-bg-border)] pr-3 space-y-1">
      <h3 className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] px-3 mb-2">Data Folders</h3>
      {folders.map((folder) => {
        const Icon = ICONS[folder.key] || Database;
        const isActive = activeFolder === folder.key;
        const isLoyal = folder.key === 'loyal';

        return (
          <button
            key={folder.key}
            type="button"
            onClick={() => onSelect(folder.key)}
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
      })}
    </div>
  );
}
