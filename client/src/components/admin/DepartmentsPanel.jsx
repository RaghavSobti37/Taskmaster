import React, { useMemo, useState } from 'react';
import { Building2, Trash2, FileText, BarChart3, Pencil, CheckSquare, Square } from 'lucide-react';
import { Card, Button, Input, Badge, CenteredModal } from '../ui';
import {
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from '../../hooks/useTaskmasterQueries';
import {
  PAGE_GROUPS,
  PRESET_PAGES,
  PERMISSION_PRESET_OPTIONS,
  resolveDepartmentPages,
} from '../../utils/pagePermissions';
import { DepartmentMonthlyReportPanel, TeamMonthlyReportPanel } from './AggregatedMonthlyReportPanel';
import { useConfirm } from '../../contexts/ConfirmContext';

const PagePermissionsEditor = ({ selectedPages, onChange }) => {
  const togglePage = (key) => {
    onChange(
      selectedPages.includes(key)
        ? selectedPages.filter((k) => k !== key)
        : [...selectedPages, key]
    );
  };

  const toggleGroup = (group) => {
    const keys = group.pages.map((p) => p.key);
    const allOn = keys.every((k) => selectedPages.includes(k));
    if (allOn) {
      onChange(selectedPages.filter((k) => !keys.includes(k)));
    } else {
      onChange([...new Set([...selectedPages, ...keys])]);
    }
  };

  return (
    <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
      {PAGE_GROUPS.map((group) => {
        const keys = group.pages.map((p) => p.key);
        const enabledCount = keys.filter((k) => selectedPages.includes(k)).length;
        const allOn = enabledCount === keys.length;

        return (
          <div key={group.id} className="border border-[var(--color-bg-border)] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center justify-between px-3 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-border)]/40 transition-colors"
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                {group.label}
              </span>
              <span className="text-[9px] font-bold text-[var(--color-text-muted)]">
                {enabledCount}/{keys.length}
              </span>
            </button>
            <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
              {group.pages.map((page) => {
                const checked = selectedPages.includes(page.key);
                return (
                  <label
                    key={page.key}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-[11px] transition-colors ${
                      checked
                        ? 'bg-[var(--color-action-primary)]/10 text-[var(--color-text-primary)]'
                        : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => togglePage(page.key)}
                    />
                    {checked ? <CheckSquare size={14} className="shrink-0 text-[var(--color-action-primary)]" /> : <Square size={14} className="shrink-0 opacity-40" />}
                    <span className="truncate">{page.label}</span>
                  </label>
                );
              })}
            </div>
            {!allOn && enabledCount > 0 && (
              <div className="px-3 pb-2">
                <button
                  type="button"
                  onClick={() => onChange([...new Set([...selectedPages, ...keys])])}
                  className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-action-primary)] hover:underline"
                >
                  Enable all in {group.label}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const DepartmentsPanel = ({ users = [], departments = [] }) => {
  const { confirm } = useConfirm();
  const [newName, setNewName] = useState('');
  const [newPreset, setNewPreset] = useState('standard');
  const [editingDept, setEditingDept] = useState(null);
  const [editPages, setEditPages] = useState([]);
  const [editPreset, setEditPreset] = useState('standard');
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
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const openEdit = (dept) => {
    setEditingDept(dept);
    setEditPreset(dept.permissionPreset || 'standard');
    setEditPages(resolveDepartmentPages(dept));
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
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const selectedPresetHelp = PERMISSION_PRESET_OPTIONS.find((o) => o.value === newPreset)?.description;

  return (
    <>
      <Card className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl space-y-4 h-fit">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-[var(--color-action-primary)]" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Departments</h4>
          </div>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => setTeamReportOpen(true)}
            className="!text-[9px] font-black uppercase"
          >
            <BarChart3 size={12} className="mr-1" />
            Team Report
          </Button>
        </div>

        <div className="space-y-2">
          <Input
            placeholder="New department name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="!py-1 !text-[11px]"
          />
          <div className="flex gap-2 items-center">
            <select
              value={newPreset}
              onChange={(e) => setNewPreset(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-[11px] outline-none"
              title="Starting template — customize per department after creation"
            >
              {PERMISSION_PRESET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newName.trim()}
              size="sm"
              className="whitespace-nowrap font-black uppercase text-[10px]"
            >
              Add
            </Button>
          </div>
          {selectedPresetHelp && (
            <p className="text-[9px] text-[var(--color-text-muted)] leading-snug">{selectedPresetHelp}</p>
          )}
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {departments.length === 0 ? (
            <div className="text-center py-6 opacity-40">
              <p className="text-[9px] font-black uppercase tracking-widest">No departments yet</p>
            </div>
          ) : departments.map((dept) => {
            const count = memberCounts[dept._id] || 0;
            const pages = resolveDepartmentPages(dept);
            return (
              <div
                key={dept._id}
                className="p-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-lg"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold uppercase tracking-tight text-[10px] truncate">{dept.name}</span>
                  <Badge variant="info" className="!text-[9px] shrink-0">{count} {count === 1 ? 'Member' : 'Members'}</Badge>
                </div>
                <div className="flex items-center justify-between mt-2 gap-2">
                  <Badge variant="slate" className="!text-[8px] uppercase font-mono">
                    {pages.length} pages enabled
                  </Badge>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(dept)}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1 transition-colors"
                      title="Edit page access"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportDept(dept)}
                      className="text-blue-500 hover:text-blue-600 p-1 transition-colors"
                      title="Monthly report"
                    >
                      <FileText size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(dept)}
                      disabled={deleteMutation.isPending}
                      className="text-rose-500 hover:text-rose-600 p-1 transition-colors"
                      title="Delete department"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <CenteredModal isOpen={!!editingDept} onClose={() => setEditingDept(null)} size="lg">
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">Page Access</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{editingDept?.name}</p>
          </div>

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
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingDept(null)}>Cancel</Button>
              <Button size="sm" onClick={handleSavePermissions} disabled={updateMutation.isPending || editPages.length === 0}>
                {updateMutation.isPending ? 'Saving...' : 'Save Access'}
              </Button>
            </div>
          </div>
        </div>
      </CenteredModal>

      <CenteredModal isOpen={!!reportDept} onClose={() => setReportDept(null)} size="full">
        <div className="p-6 max-h-[90vh] overflow-y-auto">
          <DepartmentMonthlyReportPanel
            departmentId={reportDept?._id}
            departmentName={reportDept?.name}
            isOpen={!!reportDept}
            onClose={() => setReportDept(null)}
          />
        </div>
      </CenteredModal>

      <CenteredModal isOpen={teamReportOpen} onClose={() => setTeamReportOpen(false)} size="full">
        <div className="p-6 max-h-[90vh] overflow-y-auto">
          <TeamMonthlyReportPanel isOpen={teamReportOpen} />
        </div>
      </CenteredModal>
    </>
  );
};

export default DepartmentsPanel;
