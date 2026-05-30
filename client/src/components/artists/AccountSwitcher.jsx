import React from 'react';
import { Settings } from 'lucide-react';
import { Badge } from '../ui';

export default function AccountSwitcher({ connections = [], provider, selectedId, onChange, onSetPrimary }) {
  const filtered = connections.filter((c) => c.provider === provider || (provider === 'instagram' && c.provider === 'meta'));
  if (filtered.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <Settings size={12} className="text-slate-400" />
      <select
        value={selectedId || filtered.find((c) => c.isPrimary)?._id || filtered[0]?._id}
        onChange={(e) => {
          onChange?.(e.target.value);
          onSetPrimary?.(e.target.value);
        }}
        className="text-[11px] font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 focus:outline-none"
      >
        {filtered.map((c) => (
          <option key={c._id} value={c._id}>
            {c.accountLabel || c.accountHandle || c.provider}
            {c.isPrimary ? ' ★' : ''}
          </option>
        ))}
      </select>
      {filtered.length > 1 && <Badge variant="info">{filtered.length} accounts</Badge>}
    </div>
  );
}
