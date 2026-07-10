import React, { useEffect, useState } from 'react';
import { NexusModal } from '../ui/modals';
import { Button } from '../ui/primitives';
import NexusDropdown from '../ui/NexusDropdown';
import { useUpdateOpsEntity } from '../../hooks/queries/opsHub';

export default function OpsEntityDetail({ entity, open, onClose, domains = [], canEdit, onSaved }) {
  const update = useUpdateOpsEntity();
  const [form, setForm] = useState({});

  useEffect(() => {
    if (entity) {
      setForm({
        name: entity.name || '',
        organization: entity.organization || '',
        city: entity.city || '',
        email: entity.email || '',
        phone: entity.phone || '',
        status: entity.status || 'new',
        subtype: entity.subtype || '',
        notes: entity.notes || '',
      });
    }
  }, [entity]);

  if (!entity) return null;

  const domainMeta = domains.find((d) => d.key === entity.domain);
  const subtypeOptions = [
    { value: '', label: '—' },
    ...(domainMeta?.subtypes || []).map((s) => ({ value: s.key, label: s.label })),
  ];
  const statusOptions = ['new', 'contacted', 'in_progress', 'nurturing', 'active', 'paused', 'closed'].map((s) => ({
    value: s,
    label: s.replace(/_/g, ' '),
  }));

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    await update.mutateAsync({ id: entity._id, ...form });
    onSaved?.();
    onClose();
  };

  return (
    <NexusModal isOpen={open} onClose={onClose} title={entity.name || 'Ops record'} size="md" showFooter={false}>
      <div className="space-y-3">
        <label className="block text-xs font-bold text-[var(--color-text-muted)]">
          Name
          <input
            className="mt-1 w-full rounded-lg border border-[var(--color-bg-border)] px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            disabled={!canEdit}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-bold text-[var(--color-text-muted)]">
            Organization
            <input
              className="mt-1 w-full rounded-lg border border-[var(--color-bg-border)] px-3 py-2 text-sm"
              value={form.organization}
              onChange={(e) => set('organization', e.target.value)}
              disabled={!canEdit}
            />
          </label>
          <label className="block text-xs font-bold text-[var(--color-text-muted)]">
            City
            <input
              className="mt-1 w-full rounded-lg border border-[var(--color-bg-border)] px-3 py-2 text-sm"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              disabled={!canEdit}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-bold text-[var(--color-text-muted)] mb-1">Subtype</p>
            <NexusDropdown value={form.subtype} options={subtypeOptions} onChange={(v) => set('subtype', v)} disabled={!canEdit} />
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--color-text-muted)] mb-1">Status</p>
            <NexusDropdown value={form.status} options={statusOptions} onChange={(v) => set('status', v)} disabled={!canEdit} />
          </div>
        </div>
        <label className="block text-xs font-bold text-[var(--color-text-muted)]">
          Notes
          <textarea
            className="mt-1 w-full rounded-lg border border-[var(--color-bg-border)] px-3 py-2 text-sm min-h-[80px]"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            disabled={!canEdit}
          />
        </label>
        {canEdit ? (
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={update.isPending}>Save</Button>
          </div>
        ) : null}
      </div>
    </NexusModal>
  );
}
