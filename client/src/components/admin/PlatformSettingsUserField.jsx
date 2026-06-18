import React, { useMemo, useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { Button, SearchInput } from '../ui';
import NexusDropdown from '../ui/NexusDropdown';

const userLabel = (user) => {
  if (!user) return '';
  return user.email ? `${user.name} · ${user.email}` : user.name;
};

/**
 * Pick one or many users for a PlatformSettings field.
 */
const PlatformSettingsUserField = ({
  field,
  users = [],
  value,
  onChange,
  disabled = false,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedUsers = useMemo(() => {
    if (field.multiple) return Array.isArray(value) ? value.filter(Boolean) : [];
    return value ? [value] : [];
  }, [field.multiple, value]);

  const selectedIds = useMemo(
    () => new Set(selectedUsers.map((u) => String(u._id))),
    [selectedUsers]
  );

  const availableUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => !selectedIds.has(String(u._id)))
      .filter((u) => {
        if (!q) return true;
        return (
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
        );
      });
  }, [users, selectedIds, search]);

  const addUser = (userId) => {
    const user = users.find((u) => String(u._id) === String(userId));
    if (!user) return;
    if (field.multiple) {
      onChange([...selectedUsers, user]);
    } else {
      onChange(user);
    }
    setPickerOpen(false);
    setSearch('');
  };

  const removeUser = (userId) => {
    if (field.multiple) {
      onChange(selectedUsers.filter((u) => String(u._id) !== String(userId)));
      return;
    }
    onChange(null);
  };

  return (
    <div className="space-y-3 p-4 border border-[var(--color-bg-border)] rounded-lg bg-[var(--color-bg-primary)]">
      <div>
        <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-primary)]">
          {field.label}
        </h4>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1 leading-relaxed">
          {field.description}
        </p>
        {field.envFallback ? (
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1 font-mono">
            Env fallback: {field.envFallback}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedUsers.map((user) => (
          <span
            key={user._id}
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[11px]"
          >
            <span className="font-semibold">{userLabel(user)}</span>
            {!disabled ? (
              <button
                type="button"
                onClick={() => removeUser(user._id)}
                className="text-rose-500 hover:text-rose-600"
                aria-label={`Remove ${user.name}`}
              >
                <X size={12} />
              </button>
            ) : null}
          </span>
        ))}
        {!selectedUsers.length ? (
          <span className="text-[11px] text-[var(--color-text-muted)] italic">No users selected</span>
        ) : null}
      </div>

      {!disabled && (field.multiple || !selectedUsers.length) ? (
        <div className="space-y-2">
          {!pickerOpen ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setPickerOpen(true)}
              className="!text-[10px] font-black uppercase"
            >
              <UserPlus size={12} className="mr-1" />
              Add user
            </Button>
          ) : (
            <div className="space-y-2 p-3 border border-dashed border-[var(--color-bg-border)] rounded-lg">
              <SearchInput
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="!text-xs"
              />
              {field.multiple ? (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {availableUsers.slice(0, 20).map((user) => (
                    <button
                      key={user._id}
                      type="button"
                      onClick={() => addUser(user._id)}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--color-bg-secondary)] text-[11px]"
                    >
                      {userLabel(user)}
                    </button>
                  ))}
                </div>
              ) : (
                <NexusDropdown
                  value=""
                  onChange={addUser}
                  options={availableUsers.map((u) => ({ value: u._id, label: userLabel(u) }))}
                  placeholder="Select user..."
                />
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPickerOpen(false);
                  setSearch('');
                }}
                className="!text-[10px]"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default PlatformSettingsUserField;
