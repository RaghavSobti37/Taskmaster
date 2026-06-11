import React, { useMemo, useState } from 'react';
import { Shield, Users, Layers, Pencil, Trash2, Plus, Lock } from 'lucide-react';
import { ListPageLayout, PageSkeleton, Button, Badge, Input } from '../../components/ui';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from '../../components/ui/modals';
import PagePermissionsEditor from '../../components/admin/PagePermissionsEditor';
import {
  useAdminRoles,
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

const pageLabel = (key) => {
  for (const group of PAGE_GROUPS) {
    const page = group.pages.find((p) => p.key === key);
    if (page) return page.label;
  }
  return key;
};

const AdminRolesPage = () => {
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const { data, isLoading } = useAdminRoles();
  const createMutation = useCreateOrgRole();
  const updateMutation = useUpdateOrgRole();
  const deleteMutation = useDeleteOrgRole();

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPreset, setNewPreset] = useState('standard');

  const [editingRole, setEditingRole] = useState(null);
  const [editName, setEditName] = useState('');
  const [editNameBaseline, setEditNameBaseline] = useState('');
  const [editPreset, setEditPreset] = useState('standard');
  const [editPresetBaseline, setEditPresetBaseline] = useState('standard');
  const [editPages, setEditPages] = useState([]);
  const [editPagesBaseline, setEditPagesBaseline] = useState([]);

  const orgRoles = data?.orgRoles || [];
  const projectRoles = data?.projectRoles || [];

  const stats = useMemo(() => [
    {
      id: 'org-roles',
      label: 'Org Roles',
      value: orgRoles.length,
      icon: Shield,
      variant: 'info',
      info: 'Department-based org roles with page access.',
    },
    {
      id: 'assigned',
      label: 'Assigned Users',
      value: orgRoles.reduce((sum, r) => sum + (r.memberCount || 0), 0),
      icon: Users,
      variant: 'mint',
      info: 'Users mapped to an org role.',
    },
    {
      id: 'project-roles',
      label: 'Project Roles',
      value: projectRoles.length,
      icon: Layers,
      variant: 'slate',
      info: 'Fixed project membership levels (read-only).',
    },
  ], [orgRoles, projectRoles.length]);

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
    const ok = await confirm({
      title: 'Delete role?',
      message: `Remove "${role.name}"? Users must be reassigned first.`,
      confirmLabel: 'Delete',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(role.id);
      toast({ type: 'success', message: 'Role deleted' });
    } catch (err) {
      toast({ type: 'error', message: err.response?.data?.error || err.message });
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <>
      <ListPageLayout
        containerClassName="!py-4"
        title="Roles & Permissions"
        icon={Shield}
        overview={{ stats }}
      >
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Organization roles</h2>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  Customizable department roles — controls page access via department assignment.
                </p>
              </div>
              <Button size="sm" onClick={() => setAddOpen(true)} className="font-black uppercase text-[10px]">
                <Plus size={14} className="mr-1" />
                Add role
              </Button>
            </div>

            <div className="border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] overflow-hidden">
              <div className="grid grid-cols-[1.2fr_0.8fr_1.5fr_auto] gap-3 px-4 py-2 bg-[var(--color-bg-secondary)] text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                <span>Role</span>
                <span>Preset</span>
                <span>Access</span>
                <span className="text-right">Actions</span>
              </div>
              {orgRoles.map((role) => (
                <div
                  key={role.id}
                  className="grid grid-cols-[1.2fr_0.8fr_1.5fr_auto] gap-3 px-4 py-3 border-t border-[var(--color-bg-border)] items-start"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold truncate">{role.name}</span>
                      {role.isSystem && (
                        <Badge variant="slate" className="!text-[8px] uppercase shrink-0">
                          <Lock size={10} className="mr-0.5 inline" />
                          System
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">{role.slug}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{role.memberCount} user(s)</p>
                  </div>
                  <div>
                    <Badge variant="info" className="!text-[9px] uppercase">{role.permissionPreset || 'standard'}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(role.pagePermissions || []).slice(0, 6).map((key) => (
                      <Badge key={key} variant="slate" className="!text-[8px]">{pageLabel(key)}</Badge>
                    ))}
                    {(role.pagePermissions || []).length > 6 && (
                      <Badge variant="slate" className="!text-[8px]">+{role.pagePermissions.length - 6} more</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(role)}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1"
                      title="Edit role"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(role)}
                      disabled={role.isSystem || deleteMutation.isPending}
                      className="text-rose-500 hover:text-rose-600 p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                      title={role.isSystem ? 'System roles cannot be deleted' : 'Delete role'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Project roles</h2>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Fixed per-project membership levels — assigned on each project, not org-wide.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projectRoles.map((role) => (
                <div
                  key={role.key}
                  className="p-4 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-bold">{role.label}</span>
                    <Badge variant="info" className="!text-[9px] font-mono">Rank {role.rank}</Badge>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] mb-3">{role.description}</p>
                  <ul className="space-y-1">
                    {(role.capabilities || []).map((cap) => (
                      <li key={cap} className="text-[10px] text-[var(--color-text-secondary)] flex items-start gap-1.5">
                        <span className="text-[var(--color-action-primary)] mt-0.5">•</span>
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </ListPageLayout>

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
            <p className="text-[9px] text-[var(--color-text-muted)] mt-1">
              {PERMISSION_PRESET_OPTIONS.find((o) => o.value === newPreset)?.description}
            </p>
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

export default AdminRolesPage;
