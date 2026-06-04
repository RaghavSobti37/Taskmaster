import React, { useEffect, useMemo, useState } from 'react';
import { Shield, X, Plus, Save } from 'lucide-react';
import { Card, Button, SearchInput, Badge } from '../ui';
import {
  usePlatformSettings,
  useUpdatePlatformSettings,
} from '../../hooks/useTaskmasterQueries';

const userId = (u) => String(u?._id || u || '');

const settingsToPayload = (settings) => {
  if (!settings) return {};
  const payload = {};
  for (const [key, value] of Object.entries(settings)) {
    if (key === '_id' || key === 'updatedAt') continue;
    if (Array.isArray(value)) {
      payload[key] = value.map((u) => userId(u)).filter(Boolean);
    } else if (value && typeof value === 'object') {
      payload[key] = userId(value) || null;
    } else {
      payload[key] = value || null;
    }
  }
  return payload;
};

const RoleSection = ({ field, value, users, onChange }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = field.multiple
    ? (Array.isArray(value) ? value : [])
    : value
      ? [value]
      : [];

  const selectedIds = new Set(selected.map((u) => userId(u)));

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (selectedIds.has(userId(u))) return false;
      if (!q) return true;
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    });
  }, [users, search, selectedIds]);

  const removeUser = (id) => {
    if (field.multiple) {
      onChange(selected.filter((u) => userId(u) !== id));
    } else {
      onChange(null);
    }
  };

  const addUser = (u) => {
    if (field.multiple) {
      onChange([...selected, u]);
    } else {
      onChange(u);
      setPickerOpen(false);
    }
    setSearch('');
  };

  return (
    <div className="border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] p-3 space-y-2">
      <div>
        <p className="text-[11px] font-bold text-[var(--color-text-primary)]">{field.label}</p>
        <p className="text-[10px] text-[var(--color-text-muted)] leading-snug mt-0.5">{field.description}</p>
      </div>

      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {selected.length === 0 && (
          <span className="text-[10px] text-[var(--color-text-muted)] italic">None selected</span>
        )}
        {selected.map((u) => (
          <Badge key={userId(u)} variant="slate" className="!text-[9px] gap-1 pr-1">
            <span className="truncate max-w-[140px]">{u.name || u.email}</span>
            <button
              type="button"
              className="hover:text-rose-400"
              aria-label={`Remove ${u.name}`}
              onClick={() => removeUser(userId(u))}
            >
              <X size={10} />
            </button>
          </Badge>
        ))}
      </div>

      {pickerOpen ? (
        <div className="space-y-2 pt-1">
          <SearchInput
            placeholder="Search users to add…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-36 overflow-y-auto space-y-1 border border-[var(--color-bg-border)] rounded p-1">
            {available.slice(0, 40).map((u) => (
              <button
                key={userId(u)}
                type="button"
                className="w-full text-left px-2 py-1.5 text-[10px] rounded hover:bg-[var(--color-bg-secondary)] flex justify-between gap-2"
                onClick={() => addUser(u)}
              >
                <span className="font-medium truncate">{u.name}</span>
                <span className="text-[var(--color-text-muted)] truncate">{u.email}</span>
              </button>
            ))}
            {available.length === 0 && (
              <p className="text-[10px] text-[var(--color-text-muted)] px-2 py-2">No matching users</p>
            )}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPickerOpen(false)}>
            Done
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" className="gap-1 text-[10px]" onClick={() => setPickerOpen(true)}>
          <Plus size={12} />
          Add user
        </Button>
      )}
    </div>
  );
};

const PlatformRolesPanel = ({ users = [] }) => {
  const { data, isLoading } = usePlatformSettings();
  const updateMutation = useUpdatePlatformSettings();
  const [localSettings, setLocalSettings] = useState(null);

  useEffect(() => {
    if (data?.settings) setLocalSettings(data.settings);
  }, [data?.settings]);

  const roles = data?.roles || [];

  const handleSave = async () => {
    try {
      const result = await updateMutation.mutateAsync(settingsToPayload(localSettings));
      setLocalSettings(result.settings);
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to save platform roles');
    }
  };

  if (isLoading && !localSettings) {
    return (
      <Card className="p-4 text-[10px] text-[var(--color-text-muted)]">Loading platform roles…</Card>
    );
  }

  return (
    <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-[var(--color-action-primary)]" />
          <div>
            <h4 className="tm-widget-label">Platform roles</h4>
            <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5">
              Stored in database — replaces comma-separated env ID lists.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="gap-1 shrink-0"
          onClick={handleSave}
          disabled={updateMutation.isPending || !localSettings}
        >
          <Save size={12} />
          Save
        </Button>
      </div>

      <div className="space-y-3 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
        {roles.map((field) => (
          <RoleSection
            key={field.key}
            field={field}
            value={localSettings?.[field.key]}
            users={users}
            onChange={(next) =>
              setLocalSettings((prev) => ({ ...prev, [field.key]: next }))
            }
          />
        ))}
      </div>
    </Card>
  );
};

export default PlatformRolesPanel;
