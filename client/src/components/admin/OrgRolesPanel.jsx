import React, { useMemo, useState } from 'react';
import { Shield, Pencil, Trash2, Plus, Lock } from 'lucide-react';
import { Button, Badge, Input } from '../ui';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from '../ui/modals';
import PagePermissionsEditor from './PagePermissionsEditor';
import {
  useCreateOrgRole,
  useUpdateOrgRole,
  useDeleteOrgRole,
} from '../../hooks/queries/adminRoles';
import {
  PAGE_GROUPS,
  PRESET_PAGES,
  PERMISSION_PRESET_OPTIONS,
} from '../../utils/pagePermissions';
import { useConfirm } from '../../contexts/confirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';
import { getOrgRoleDeleteBlockReason } from '../../utils/adminRoleDelete';

const actionBtnClass =
  'inline-flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:p-1.5 rounded-[var(--radius-atomic)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors';

const pageLabel = (key) => {
  for (const group of PAGE_GROUPS) {
    const page = group.pages.find((p) => p.key === key);
    if (page) return page.label;
  }
  return key;
};

const presetLabel = (value) =>
  PERMISSION_PRESET_OPTIONS.find((o) => o.value === value)?.label || value || 'standard';

const OrgRolesPanel = ({ orgRoles = [] }) => {
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const createMutation = useCreateOrgRole();
  const updateMutation = useUpdateOrgRole();
  const deleteMutation = useDeleteOrgRole();

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPreset, setNewPreset] = useState('standard');
  const [selectedRoleId, setSelectedRoleId] = useState(null);

  const [editingRole, setEditingRole] = useState(null);
  const [editName, setEditName] = useState('');
  const [editNameBaseline, setEditNameBaseline] = useState('');
  const [editPreset, setEditPreset] = useState('standard');
  const [editPresetBaseline, setEditPresetBaseline] = useState('standard');
  const [editPages, setEditPages] = useState([]);
  const [editPagesBaseline, setEditPagesBaseline] = useState([]);

  const selectedRole = useMemo(
    () => orgRoles.find((r) => r.id === selectedRoleId) || null,
    [orgRoles, selectedRoleId],
  );

  const openEdit = (role) => {
    setEditingRole(role);
    setEditName(role.name);
    setEditNameBaseline(role.name);
    setEditPreset(role.permissionPreset || 'standard');
    setEditPresetBaseline(role.permissionPreset || 'standard');
    setEditPages(role.pagePermissions || []);
    setEditPagesBaseline(cloneSnapshot(role.pagePermissions || []));
  };

  const applyPresetToEdit = (preset) => {
    setEditPreset(preset);
    setEditPages(PRESET_PAGES[preset] || PRESET_PAGES.standard);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createMutation.mutateAsync({
        name: newName.trim(),
        permissionPreset: newPreset,
        pagePermissions: PRESET_PAGES[newPreset] || PRESET_PAGES.standard,
      });
      toast({ type: 'success', message: `Role "${newName.trim()}" created` });
      setAddOpen(false);
      setNewName('');
      setNewPreset('standard');
    } catch (err) {
      toast({ type: 'error', message: err.response?.data?.error || err.message });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRole) return;
    try {
      await updateMutation.mutateAsync({
        id: editingRole.id,
        data: {
          name: editName.trim(),
          permissionPreset: editPreset,
          pagePermissions: editPages,
        },
      });
      toast({ type: 'success', message: 'Role updated' });
      setEditingRole(null);
    } catch (err) {
      toast({ type: 'error', message: err.response?.data?.error || err.message });
    }
  };

  const hasEdits =
    !!editingRole &&
    (editName !== editNameBaseline
      || editPreset !== editPresetBaseline
      || !stableJsonEqual(editPages, editPagesBaseline));

  const { revert: revertEdits } = useUnsavedChanges({
    hasChanges: hasEdits,
    onSave: handleSaveEdit,
    onCancel: () => {
      setEditName(editNameBaseline);
      setEditPreset(editPresetBaseline);
      setEditPages(cloneSnapshot(editPagesBaseline));
    },
    isSaving: updateMutation.isPending,
    enabled: hasEdits,
  });

  const handleDelete = async (role) => {
    const blocked = getOrgRoleDeleteBlockReason(role);
    if (blocked) {
      toast({ type: 'error', message: blocked });
      return;
    }
    const ok = await confirm({
      title: 'Delete role?',
      message: `Remove "${role.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(role.id);
      toast({ type: 'success', message: 'Role deleted' });
      if (selectedRoleId === role.id) setSelectedRoleId(null);
    } catch (err) {
      toast({ type: 'error', message: err.response?.data?.error || err.message });
    }
  };

  const selectedPresetHelp = PERMISSION_PRESET_OPTIONS.find((o) => o.value === newPreset)?.description;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] gap-4 lg:gap-6">
        <section className="space-y-3 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Organization roles</h2>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Department roles with page access — assign users from the Users admin page.
              </p>
            </div>
            <Button size="sm" onClick={() => setAddOpen(true)} className="font-black uppercase text-[10px] shrink-0">
              <Plus size={14} className="mr-1" />
              Add role
            </Button>
          </div>

          <div className="border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] overflow-hidden bg-[var(--color-bg-primary)]">
            <div className="hidden md:grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto_auto] gap-3 px-4 py-2 bg-[var(--color-bg-secondary)] text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              <span>Role</span>
              <span>Preset</span>
              <span>Page access</span>
              <span className="text-center">Users</span>
              <span className="text-right">Actions</span>
            </div>

            {orgRoles.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Shield size={28} className="mx-auto mb-2 text-[var(--color-text-muted)] opacity-40" />
                <p className="text-[11px] font-bold text-[var(--color-text-muted)]">No org roles yet</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Add one to preset page access for departments.</p>
              </div>
            ) : (
              orgRoles.map((role) => {
                const pages = role.pagePermissions || [];
                const isSelected = selectedRoleId === role.id;
                return (
                  <div
                    key={role.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedRoleId(role.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedRoleId(role.id);
                      }
                    }}
                    className={`border-t border-[var(--color-bg-border)] first:border-t-0 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[var(--color-action-primary)]/5' : 'hover:bg-[var(--color-bg-secondary)]/60'
                    }`}
                  >
                    <div className="hidden md:grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto_auto] gap-3 px-4 py-3 items-center">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="text-sm font-bold truncate">{role.name}</span>
                        {role.isSystem && (
                          <Badge
                            variant="neutral"
                            className="!text-[8px] uppercase shrink-0 border border-[var(--color-action-primary)]/20 text-[var(--color-action-primary)]"
                          >
                            <Lock size={9} className="mr-0.5 inline" />
                            System
                          </Badge>
                        )}
                      </div>
                      <Badge variant="info" className="!text-[9px] uppercase w-fit truncate max-w-full">
                        {presetLabel(role.permissionPreset)}
                      </Badge>
                      <Badge variant="slate" className="!text-[9px] uppercase font-mono w-fit">
                        {pages.length} pages
                      </Badge>
                      <Badge variant="info" className="!text-[9px] justify-self-center">
                        {role.memberCount || 0}
                      </Badge>
                      <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => openEdit(role)} className={actionBtnClass} title="Edit role">
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(role)}
                          disabled={!!getOrgRoleDeleteBlockReason(role) || deleteMutation.isPending}
                          className={`${actionBtnClass} !text-rose-500 hover:!text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed`}
                          title={getOrgRoleDeleteBlockReason(role) || 'Delete role'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="md:hidden px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold">{role.name}</span>
                          {role.isSystem && (
                            <Badge
                              variant="neutral"
                              className="!text-[8px] uppercase shrink-0 border border-[var(--color-action-primary)]/20 text-[var(--color-action-primary)]"
                            >
                              <Lock size={9} className="mr-0.5 inline" />
                              System
                            </Badge>
                          )}
                        </div>
                        <Badge variant="info" className="!text-[9px] shrink-0">
                          {role.memberCount || 0} {role.memberCount === 1 ? 'user' : 'users'}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-[var(--color-text-muted)] font-mono">{role.slug}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="info" className="!text-[9px] uppercase">
                          {presetLabel(role.permissionPreset)}
                        </Badge>
                        <Badge variant="slate" className="!text-[9px] font-mono">
                          {pages.length} pages
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => openEdit(role)} className={actionBtnClass} title="Edit role">
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(role)}
                          disabled={!!getOrgRoleDeleteBlockReason(role) || deleteMutation.isPending}
                          className={`${actionBtnClass} !text-rose-500 hover:!text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed`}
                          title={getOrgRoleDeleteBlockReason(role) || 'Delete role'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <aside className="hidden lg:block min-w-0">
          <div className="sticky top-4 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] p-4 min-h-[280px] flex flex-col">
            {selectedRole ? (
              <>
                <div className="flex items-start gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)] shrink-0">
                    <Shield size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold truncate">{selectedRole.name}</h3>
                      {selectedRole.isSystem && (
                        <Badge
                          variant="neutral"
                          className="!text-[8px] uppercase shrink-0 border border-[var(--color-action-primary)]/20 text-[var(--color-action-primary)]"
                        >
                          System
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5 truncate">{selectedRole.slug}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                      {selectedRole.memberCount || 0} assigned user(s)
                    </p>
                  </div>
                </div>
                <div className="space-y-3 flex-1 min-h-0">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                      Permission preset
                    </p>
                    <Badge variant="info" className="!text-[9px] uppercase">
                      {presetLabel(selectedRole.permissionPreset)}
                    </Badge>
                  </div>
                  <div className="min-h-0 flex flex-col">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                      Page access ({(selectedRole.pagePermissions || []).length})
                    </p>
                    <ul className="text-[10px] text-[var(--color-text-secondary)] space-y-0.5 overflow-y-auto max-h-[180px] pr-1">
                      {(selectedRole.pagePermissions || []).map((key) => (
                        <li key={key} className="truncate">{pageLabel(key)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-4 mt-auto border-t border-[var(--color-bg-border)]">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(selectedRole)}>
                    <Pencil size={12} className="mr-1" />
                    Edit role
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-2 py-6">
                <Shield size={32} className="text-[var(--color-text-muted)] opacity-30 mb-3" />
                <p className="text-[11px] font-bold text-[var(--color-text-muted)]">Select a role</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1 max-w-[220px]">
                  Click a row to preview preset, page access, and quick actions.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <ModalShell isOpen={addOpen} onClose={() => setAddOpen(false)} size="md">
        <ModalHeader title="Add org role" onClose={() => setAddOpen(false)} />
        <ModalBody className="space-y-4">
          <Input
            placeholder="Role name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1 block">
              Starting template
            </label>
            <select
              value={newPreset}
              onChange={(e) => setNewPreset(e.target.value)}
              className="w-full px-2 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-[11px] outline-none"
            >
              {PERMISSION_PRESET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {selectedPresetHelp && (
              <p className="text-[9px] text-[var(--color-text-muted)] mt-1">{selectedPresetHelp}</p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!newName.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating…' : 'Create role'}
          </Button>
        </ModalFooter>
      </ModalShell>

      <ModalShell isOpen={!!editingRole} onClose={() => setEditingRole(null)} size="lg">
        <ModalHeader
          title="Edit org role"
          subtitle={editingRole?.slug}
          onClose={() => setEditingRole(null)}
        />
        <ModalBody className="space-y-4">
          <Input
            placeholder="Role name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Template:</span>
            {PERMISSION_PRESET_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => applyPresetToEdit(o.value)}
                className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide border transition-colors ${
                  editPreset === o.value
                    ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]'
                    : 'border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <PagePermissionsEditor selectedPages={editPages} onChange={setEditPages} />
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="sm" onClick={revertEdits} disabled={!hasEdits || updateMutation.isPending}>
            Discard
          </Button>
          <Button
            size="sm"
            variant="success"
            onClick={handleSaveEdit}
            disabled={!hasEdits || !editName.trim() || updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </ModalFooter>
      </ModalShell>
    </>
  );
};

export default OrgRolesPanel;
