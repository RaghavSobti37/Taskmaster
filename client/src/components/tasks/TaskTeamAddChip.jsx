import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search } from 'lucide-react';
import { UserAvatar } from '../ui/UserAvatar';
import { resolveUserDepartmentName } from '../../utils/taskAssigneeRows';

export const TEAM_CHIP_CLASS =
  'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border shrink-0 h-[2.375rem]';

const MENU_Z = 99999;

export default function TaskTeamAddChip({
  directoryUsers = [],
  assigneeIds = [],
  lockedAssigneeIds = [],
  onAdd,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const lockedSet = useMemo(
    () => new Set((lockedAssigneeIds || []).map(String)),
    [lockedAssigneeIds]
  );
  const assignedSet = useMemo(
    () => new Set((assigneeIds || []).map(String)),
    [assigneeIds]
  );

  const availableUsers = useMemo(
    () =>
      (directoryUsers || []).filter((u) => {
        const id = String(u._id || u.user?._id);
        return id && !assignedSet.has(id);
      }),
    [directoryUsers, assignedSet]
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableUsers;
    return availableUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        resolveUserDepartmentName(u).toLowerCase().includes(q)
    );
  }, [availableUsers, search]);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 240;
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: Math.max(8, left),
      width: menuWidth,
      zIndex: MENU_Z,
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const onDoc = (e) => {
      if (
        menuRef.current?.contains(e.target) ||
        triggerRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const handleAdd = (userId) => {
    const id = String(userId);
    if (!id || assignedSet.has(id) || !onAdd) return;
    const merged = [...new Set([...(assigneeIds || []).map(String), id])];
    onAdd(merged);
    setOpen(false);
    setSearch('');
  };

  if (disabled) return null;

  return (
    <>
      <li className="list-none">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${TEAM_CHIP_CLASS} border-dashed border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]/40 text-[var(--color-text-muted)] hover:border-[var(--color-action-primary)]/50 hover:text-[var(--color-action-primary)] hover:bg-[var(--color-action-primary)]/5 transition-colors`}
          aria-label="Add team member"
          aria-expanded={open}
        >
          <span className="w-5 h-5 rounded-full border border-dashed border-current flex items-center justify-center shrink-0">
            <Plus size={12} strokeWidth={2.5} />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider pr-0.5">Add</span>
        </button>
      </li>

      {open && menuStyle && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] shadow-xl overflow-hidden"
          role="listbox"
        >
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--color-bg-border)]">
            <Search size={12} className="text-[var(--color-text-muted)] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people…"
              className="w-full bg-transparent text-xs outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
              autoFocus
            />
          </div>
          <ul className="max-h-[200px] overflow-y-auto tm-modal-scroll py-1">
            {filteredUsers.length === 0 ? (
              <li className="px-3 py-2 text-[10px] text-[var(--color-text-muted)] italic">
                {availableUsers.length === 0 ? 'Everyone is already on this task' : 'No matches'}
              </li>
            ) : (
              filteredUsers.map((u) => {
                const id = String(u._id);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      role="option"
                      disabled={lockedSet.has(id) && assignedSet.has(id)}
                      onClick={() => handleAdd(id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
                    >
                      <UserAvatar user={u} name={u.name} avatar={u.avatar} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-[var(--color-text-primary)] truncate">{u.name}</p>
                        <p className="text-[9px] text-[var(--color-text-muted)] truncate">
                          {resolveUserDepartmentName(u)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>,
        document.body
      )}
    </>
  );
}
