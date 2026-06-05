import React from 'react';
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
};

export default function DataHubInletCluster({ inlets = [], max = 6 }) {
  const entries = dedupeInletEntries(inlets).slice(0, max);

  if (!entries.length) {
    return <span className="text-[9px] text-[var(--color-text-muted)]">—</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {entries.map((inlet) => {
        const meta = INLET_META[inlet.key] || { label: inlet.key, icon: 'Database' };
        const Icon = ICON_MAP[meta.icon] || Database;
        const count = inlet.recordIds?.length;
        const title = count ? `${meta.label} (${count})` : meta.label;
        return (
          <span
            key={inlet.key}
            title={title}
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[var(--token-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <Icon size={14} strokeWidth={1.75} />
          </span>
        );
      })}
      {inlets.length > max && (
        <span className="text-[9px] font-bold text-[var(--color-text-muted)]">+{inlets.length - max}</span>
      )}
    </div>
  );
}
