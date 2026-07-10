import React, { useState } from 'react';
import {
  ShoppingBag,
  UserPlus,
  FileSpreadsheet,
  Phone,
  MessageSquare,
  UserX,
  Mail,
  UsersRound,
  Activity,
  Star,
  Database,
  Users,
  CheckCircle,
  MapPin,
  Film,
  GraduationCap,
  Music,
  Newspaper,
  Mic,
  Megaphone,
  Building,
} from 'lucide-react';
import { dedupeInletEntries, INLET_META } from '../../utils/dataHubInlets';

const ICON_MAP = {
  ShoppingBag,
  UserPlus,
  FileSpreadsheet,
  Phone,
  MessageSquare,
  UserX,
  Mail,
  UsersRound,
  Activity,
  Star,
  Database,
  Users,
  CheckCircle,
  MapPin,
  Film,
  GraduationCap,
  Music,
  Newspaper,
  Mic,
  Megaphone,
  Building,
};

export default function DataHubInletCluster({ inlets = [], max = 6 }) {
  const [expanded, setExpanded] = useState(false);
  const unique = dedupeInletEntries(inlets);
  const entries = unique.slice(0, max);

  if (!entries.length) {
    return <span className="text-[9px] text-[var(--color-text-muted)]">—</span>;
  }

  if (!expanded && unique.length > 1) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
        className="inline-flex items-center px-2 py-0.5 rounded-md border border-[var(--color-bg-border)] bg-[var(--token-surface-2)] text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-action-primary)]/40 transition-colors"
        title={unique.map((i) => INLET_META[i.key]?.label || i.key).join(', ')}
      >
        {unique.length} sources
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap max-w-[12rem]">
      {entries.map((inlet) => {
        const meta = INLET_META[inlet.key] || { label: inlet.key, icon: 'Database' };
        const Icon = ICON_MAP[meta.icon] || Database;
        const count = inlet.recordIds?.length;
        const title = count ? `${meta.label} (${count})` : meta.label;
        return (
          <span
            key={inlet.key}
            title={title}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-[var(--token-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <Icon size={12} strokeWidth={1.75} className="shrink-0" />
            <span className="text-[8px] font-bold uppercase truncate max-w-[4.5rem]">{meta.label}</span>
          </span>
        );
      })}
      {unique.length > max && (
        <span className="text-[9px] font-bold text-[var(--color-text-muted)]">+{unique.length - max}</span>
      )}
      {unique.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          className="text-[8px] font-bold text-[var(--color-action-primary)] uppercase"
        >
          Less
        </button>
      )}
    </div>
  );
}
