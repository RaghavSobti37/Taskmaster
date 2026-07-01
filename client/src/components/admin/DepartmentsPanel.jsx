import React, { useMemo, useState } from 'react';
import { Building2, Trash2, FileText, BarChart3, Pencil, Plus } from 'lucide-react';
import { Button, Input, Badge } from '../ui';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from '../ui/modals';
import {
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from '../../hooks/useTaskmasterQueries';
import {
  PRESET_PAGES,
  PERMISSION_PRESET_OPTIONS,
  resolveDepartmentPages,
} from '../../utils/pagePermissions';
import PagePermissionsEditor from './PagePermissionsEditor';
import { DepartmentMonthlyReportPanel, TeamMonthlyReportPanel } from './AggregatedMonthlyReportPanel';
import { useConfirm } from '../../contexts/confirmContext';
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';

const actionBtnClass =
  'inline-flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:p-1.5 rounded-[var(--radius-atomic)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors';

const DepartmentsPanel = ({ users = [], departments = [] }) => {
  const { confirm } = useConfirm();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPreset, setNewPreset] = useState('standard');
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [editingDept, setEditingDept] = useState(null);
  const [editPages, setEditPages] = useState([]);
  const [editPagesBaseline, setEditPagesBaseline] = useState([]);
  const [editPreset, setEditPreset] = useState('standard');
  const [editPresetBaseline, setEditPresetBaseline] = useState('standard');
  const [reportDept, setReportDept] = useState(null);
  const [teamReportOpen, setTeamReportOpen] = useState(false);

  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();

  const memberCounts = useMemo(() => {
    const counts = {};
    users.forEach((u) => {
      const id = u.departmentId?._id || u.departmentId;
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }, [users]);

  const selectedDept = useMemo(
    () => departments.find((d) => d._id === selectedDeptId) || null,
    [departments, selectedDeptId],
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createMutation.mutateAsync({
        name: newName.trim(),
        permissionPreset: newPreset,
        pagePermissions: PRESET_PAGES[newPreset] || PRESET_PAGES.standard,
      });
      setNewName('');
      setNewPreset('standard');
      setAddOpen(false);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const openEdit = (dept) => {
    const pages = resolveDepartmentPages(dept);
    const preset = dept.permissionPreset || 'standard';
    setEditingDept(dept);
    setEditPreset(preset);
    setEditPresetBaseline(preset);
    setEditPages(pages);
    setEditPagesBaseline(cloneSnapshot(pages));
  };

  const applyPresetToEdit = (preset) => {
    setEditPreset(preset);
    setEditPages(PRESET_PAGES[preset] || PRESET_PAGES.standard);
  };

  const handleSavePermissions = async () => {
    if (!editingDept) return;
    try {
      await updateMutation.mutateAsync({
        id: editingDept._id,
        data: {
          permissionPreset: editPreset,
          pagePermissions: editPages,
        },
      });
      setEditingDept(null);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const hasPermissionEdits =
    !!editingDept &&
    (editPreset !== editPresetBaseline || !stableJsonEqual(editPages, editPagesBaseline));

  const { revert: revertPermissionEdits } = useUnsavedChanges({
    hasChanges: hasPermissionEdits,
    onSave: handleSavePermissions,
    onCancel: () => {
      setEditPages(cloneSnapshot(editPagesBaseline));
      setEditPreset(editPresetBaseline);
    },
    isSaving: updateMutation.isPending,
    enabled: false,
  });

  const handleDelete = async (dept) => {
    const ok = await confirm({
      title: 'Delete department?',
      message: `Remove "${dept.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(dept._id);
      if (selectedDeptId === dept._id) setSelectedDeptId(null);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const selectedPresetHelp = PERMISSION_PRESET_OPTIONS.find((o) => o.value === newPreset)?.description;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] gap-4 lg:gap-6">
        <section className="space-y-3 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Departments</h2>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Org groups with page-access presets — assign users from the Users admin page.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTeamReportOpen(true)}
                className="font-black uppercase text-[10px]"
              >
                <BarChart3 size={14} className="mr-1" />
                Team report
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)} className="font-black uppercase text-[10px]">
                <Plus size={14} className="mr-1" />
                Add department
              </Button>
            </div>
          </div>

          <div className="border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] overflow-hidden bg-[var(--color-bg-primary)]">
            <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] gap-3 px-4 py-2 bg-[var(--color-bg-secondary)] text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              <span>Name</span>
              <span>Page access</span>
              <span className="text-center">Members</span>
              <span className="text-right">Actions</span>
            </div>

            {departments.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Building2 size={28} className="mx-auto mb-2 text-[var(--color-text-muted)] opacity-40" />
                <p className="text-[11px] font-bold text-[var(--color-text-muted)]">No departments yet</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Add one to group users and preset page access.</p>
              </div>
            ) : (
              departments.map((dept) => {
                const count = memberCounts[dept._id] || 0;
                const pages = resolveDepartmentPages(dept);
                const isSelected = selectedDeptId === dept._id;
                return (
                  <div
                    key={dept._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDeptId(dept._id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDeptId(dept._id);
                      }
                    }}
                    className={`border-t border-[var(--color-bg-border)] first:border-t-0 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[var(--color-action-primary)]/5' : 'hover:bg-[var(--color-bg-secondary)]/60'
                    }`}
                  >
                    <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] gap-3 px-4 py-3 items-center">
                      <span className="text-sm font-bold truncate">{dept.name}</span>
                      <Badge variant="slate" className="!text-[9px] uppercase font-mono w-fit">
                        {pages.length} pages · {dept.permissionPreset || 'standard'}
                      </Badge>
                      <Badge variant="info" className="!text-[9px] justify-self-center">
                        {count}
                      </Badge>
                      <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => openEdit(dept)} className={actionBtnClass} title="Edit page access">
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportDept(dept)}
                          className={`${actionBtnClass} !text-blue-500 hover:!text-blue-600`}
                          title="Monthly report"
                        >
                          <FileText size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(dept)}
                          disabled={deleteMutation.isPending}
                          className={`${actionBtnClass} !text-rose-500 hover:!text-rose-600`}
                          title="Delete department"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="md:hidden px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold">{dept.name}</span>
                        <Badge variant="info" className="!text-[9px] shrink-0">
                          {count} {count === 1 ? 'member' : 'members'}
                        </Badge>
                      </div>
                      <Badge variant="slate" className="!text-[9px] uppercase font-mono">
                        {pages.length} pages · {dept.permissionPreset || 'standard'}
                      </Badge>
                      <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => openEdit(dept)} className={actionBtnClass} title="Edit page access">
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportDept(dept)}
                          className={`${actionBtnClass} !text-blue-500 hover:!text-blue-600`}
                          title="Monthly report"
                        >
                          <FileText size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(dept)}
                          disabled={deleteMutation.isPending}
                          className={`${actionBtnClass} !text-rose-500 hover:!text-rose-600`}
                          title="Delete department"
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
          <div className="sticky top-4 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] p-4 min-h-[240px] flex flex-col">
            {selectedDept ? (
              <>
                <div className="flex items-start gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)] shrink-0">
                    <Building2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold truncate">{selectedDept.name}</h3>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      {memberCounts[selectedDept._id] || 0} assigned user(s)
                    </p>
                  </div>
                </div>
                <div className="space-y-3 flex-1">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                      Permission preset
                    </p>
                    <Badge variant="info" className="!text-[9px] uppercase">
                      {selectedDept.permissionPreset || 'standard'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                      Page access
                    </p>
                    <Badge variant="slate" className="!text-[9px] font-mono">
                      {resolveDepartmentPages(selectedDept).length} pages enabled
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-4 mt-auto border-t border-[var(--color-bg-border)]">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(selectedDept)}>
                    <Pencil size={12} className="mr-1" />
                    Edit access
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setReportDept(selectedDept)}>
                    <FileText size={12} className="mr-1" />
                    Report
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-2 py-6">
                <Building2 size={32} className="text-[var(--color-text-muted)] opacity-30 mb-3" />
                <p className="text-[11px] font-bold text-[var(--color-text-muted)]">Select a department</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1 max-w-[220px]">
                  Click a row to preview preset, page count, and quick actions.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <ModalShell isOpen={addOpen} onClose={() => setAddOpen(false)} size="md">
        <ModalHeader title="Add department" onClose={() => setAddOpen(false)} />
        <ModalBody className="space-y-4">
          <Input
            placeholder="Department name"
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
            {createMutation.isPending ? 'Creating…' : 'Create department'}
          </Button>
        </ModalFooter>
      </ModalShell>

      <ModalShell isOpen={!!editingDept} onClose={() => setEditingDept(null)} size="lg">
        <ModalHeader
          title="Page Access"
          subtitle={editingDept?.name}
          onClose={() => setEditingDept(null)}
        />
        <ModalBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Quick template:</span>
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

          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-bg-border)]">
            <span className="text-[10px] text-[var(--color-text-muted)]">{editPages.length} pages selected</span>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={revertPermissionEdits}
            disabled={!hasPermissionEdits || updateMutation.isPending}
          >
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            variant="success"
            onClick={handleSavePermissions}
            disabled={!hasPermissionEdits || updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </ModalFooter>
      </ModalShell>

      <ModalShell isOpen={!!reportDept} onClose={() => setReportDept(null)} size="full">
        <ModalHeader
          title="Department report"
          subtitle={reportDept?.name}
          onClose={() => setReportDept(null)}
        />
        <ModalBody className="max-h-[80vh] overflow-y-auto">
          <DepartmentMonthlyReportPanel
            departmentId={reportDept?._id}
            departmentName={reportDept?.name}
            isOpen={!!reportDept}
            onClose={() => setReportDept(null)}
          />
        </ModalBody>
      </ModalShell>

      <ModalShell isOpen={teamReportOpen} onClose={() => setTeamReportOpen(false)} size="full">
        <ModalHeader title="Team report" onClose={() => setTeamReportOpen(false)} />
        <ModalBody>
          <TeamMonthlyReportPanel isOpen={teamReportOpen} />
        </ModalBody>
      </ModalShell>
    </>
  );
};

export default DepartmentsPanel;
