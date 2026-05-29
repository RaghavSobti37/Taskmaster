import React, { useMemo, useState } from 'react';
import { Plus, UserPlus, Check } from 'lucide-react';
import { Button } from './primitives';
import NexusDropdown from './NexusDropdown';
import SearchInput from './SearchInput';
import SectionCard from './SectionCard';
import RoleOptionBoxes from './RoleOptionBoxes';
import { PROJECT_ROLE_OPTIONS } from '../../constants/taskOptions';
import { suggestProjectRole } from '../../utils/taskText';
import { getDepartmentSlug } from '../../utils/departmentPermissions';

const UserAvatar = ({ user, size = 'md' }) => {
  const sizes = { sm: 'w-7 h-7 text-[9px]', md: 'w-9 h-9 text-[10px]', lg: 'w-11 h-11 text-xs' };
  return (
    <div className={`${sizes[size]} rounded-lg bg-[var(--color-action-primary)]/10 flex items-center justify-center font-bold text-[var(--color-action-primary)] overflow-hidden shrink-0`}>
      {user?.avatar ? (
        <img src={user.avatar} alt="" className="w-full h-full object-cover" />
      ) : (
        (user?.name || '?').substring(0, 2).toUpperCase()
      )}
    </div>
  );
};

/**
 * AddMembers — pick user + project role. Variants: bar (NexusDropdown), card, picker (recommended).
 */
const AddMembers = ({
  variant = 'picker',
  users = [],
  excludeIds = [],
  onAdd,
  roleOptions = PROJECT_ROLE_OPTIONS,
  defaultRole = 'member',
  loading = false,
  title = 'Add members',
  subtitle,
  className = '',
}) => {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [projectRole, setProjectRole] = useState(defaultRole);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const availableUsers = useMemo(
    () => users.filter((u) => !excludeIds.includes(u._id)),
    [users, excludeIds]
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableUsers;
    return availableUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [availableUsers, search]);

  const selectedUser = users.find((u) => u._id === selectedUserId);
  const userOptions = availableUsers.map((u) => ({ value: u._id, label: u.name }));

  const handleSelectUser = (userId) => {
    setSelectedUserId(userId);
    const user = users.find((u) => u._id === userId);
    if (user) setProjectRole(suggestProjectRole(getDepartmentSlug(user)));
  };

  const handleAdd = async () => {
    if (!selectedUserId || submitting || !onAdd) return;
    setSubmitting(true);
    try {
      await onAdd(selectedUserId, projectRole);
      setSelectedUserId('');
      setProjectRole(defaultRole);
      setSearch('');
    } finally {
      setSubmitting(false);
    }
  };

  if (variant === 'card') {
    return (
      <SectionCard
        title={title}
        subtitle={subtitle || 'Select a teammate and assign a project role'}
        actions={
          <Button size="sm" disabled={!selectedUserId || submitting} onClick={handleAdd}>
            <UserPlus size={14} />
            {submitting ? 'Adding...' : 'Add'}
          </Button>
        }
        className={className}
      >
        <div className="space-y-4 w-full">
          <NexusDropdown
            label="Member"
            options={userOptions}
            value={selectedUserId}
            onChange={handleSelectUser}
            placeholder={loading ? 'Loading...' : 'Choose member'}
            searchable
            disabled={loading}
          />
          <RoleOptionBoxes
            value={projectRole}
            onChange={setProjectRole}
            options={roleOptions}
            disabled={!selectedUserId}
          />
        </div>
      </SectionCard>
    );
  }

  if (variant === 'bar') {
    return (
      <div className={`space-y-3 w-full min-w-0 ${className}`}>
        {(title || subtitle) && (
          <div>
            {title && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-primary)]">{title}</p>
            )}
            {subtitle && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>}
          </div>
        )}
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 w-full">
          <div className="flex-1 min-w-0">
            <NexusDropdown
              label="Member"
              options={userOptions}
              value={selectedUserId}
              onChange={handleSelectUser}
              placeholder={loading ? 'Loading...' : 'Select member'}
              searchable
              disabled={loading}
            />
          </div>
          <div className="w-full lg:flex-1 lg:max-w-sm min-w-0">
            <RoleOptionBoxes
              value={projectRole}
              onChange={setProjectRole}
              options={roleOptions}
              disabled={!selectedUserId}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            disabled={!selectedUserId || submitting}
            onClick={handleAdd}
          >
            <Plus size={14} />
            {submitting ? 'Adding...' : 'Add'}
          </Button>
        </div>
      </div>
    );
  }

  // picker (default)
  return (
    <div
      className={`w-full min-w-[min(100%,280px)] flex flex-col rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] overflow-hidden ${className}`}
    >
      <div className="shrink-0 px-4 py-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-primary)]">{title}</p>
        {subtitle && <p className="text-xs text-[var(--color-text-muted)] mt-1">{subtitle}</p>}
      </div>

      <div className="flex flex-col gap-4 p-4 w-full min-w-0">
        <SearchInput
          label="Search team"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name or email..."
        />

        <div className="w-full min-w-0 min-h-[8rem] max-h-52 overflow-y-auto custom-scrollbar rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-1.5 space-y-1">
          {loading && (
            <p className="text-xs text-center py-8 text-[var(--color-text-muted)]">Loading team...</p>
          )}
          {!loading && filteredUsers.length === 0 && (
            <p className="text-xs text-center py-8 text-[var(--color-text-muted)]">No members available</p>
          )}
          {!loading &&
            filteredUsers.map((user) => {
              const selected = selectedUserId === user._id;
              return (
                <button
                  key={user._id}
                  type="button"
                  onClick={() => handleSelectUser(user._id)}
                  className={`w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-atomic)] text-left transition-colors ${
                    selected
                      ? 'bg-[var(--color-action-primary)]/10 border border-[var(--color-action-primary)]/30'
                      : 'hover:bg-[var(--color-bg-secondary)] border border-transparent'
                  }`}
                >
                  <UserAvatar user={user} size="sm" />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-sm font-semibold truncate">{user.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
                  </div>
                  {selected && <Check size={16} className="text-[var(--color-action-primary)] shrink-0" />}
                </button>
              );
            })}
        </div>

        {selectedUser && (
          <div className="w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-atomic)] bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
            <UserAvatar user={selectedUser} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Selected</p>
              <p className="text-sm font-semibold truncate">{selectedUser.name}</p>
            </div>
          </div>
        )}

        <div className="w-full min-w-0 space-y-3 pt-1 border-t border-[var(--color-bg-border)]">
          <RoleOptionBoxes
            value={projectRole}
            onChange={setProjectRole}
            options={roleOptions}
            disabled={!selectedUserId}
          />
          <Button
            type="button"
            className="w-full min-h-[2.5rem]"
            disabled={!selectedUserId || submitting}
            onClick={handleAdd}
          >
            <Plus size={14} />
            {submitting ? 'Adding...' : 'Add to project'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddMembers;
