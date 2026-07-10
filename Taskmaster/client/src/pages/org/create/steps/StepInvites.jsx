import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '../../../../components/ui/primitives';
import RoleOptionBoxes from '../../../../components/ui/RoleOptionBoxes';
import { EMPTY_INVITE_ROW, ORG_INVITE_ROLE_OPTIONS } from '../../../../constants/orgCreateOptions';

export default function StepInvites({ form, setForm, fieldError }) {
  const rows = form.invites || [];

  const updateRow = (index, patch) => {
    setForm((prev) => {
      const invites = [...(prev.invites || [])];
      invites[index] = { ...invites[index], ...patch };
      return { ...prev, invites };
    });
  };

  const addRow = () => {
    setForm((prev) => ({
      ...prev,
      invites: [...(prev.invites || []), { ...EMPTY_INVITE_ROW }],
    }));
  };

  const removeRow = (index) => {
    setForm((prev) => {
      const invites = (prev.invites || []).filter((_, i) => i !== index);
      return { ...prev, invites: invites.length ? invites : [{ ...EMPTY_INVITE_ROW }] };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Invite teammates</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Add colleagues now or skip and invite later from settings.
        </p>
      </div>

      <ul className="space-y-4">
        {rows.map((row, index) => (
          <li
            key={index}
            className="rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-4 space-y-3"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-3">
                <Input
                  label="Email"
                  type="email"
                  value={row.email}
                  onChange={(e) => updateRow(index, { email: e.target.value })}
                  placeholder="colleague@company.com"
                />
                <RoleOptionBoxes
                  label="Organization role"
                  value={row.role}
                  onChange={(role) => updateRow(index, { role })}
                  options={ORG_INVITE_ROLE_OPTIONS}
                />
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  className="mt-6 shrink-0 rounded-md p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-rose-500"
                  onClick={() => removeRow(index)}
                  aria-label="Remove invite row"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Button type="button" variant="secondary" size="sm" onClick={addRow}>
        <Plus size={14} aria-hidden />
        Add another
      </Button>

      {fieldError && <p className="text-xs text-rose-500">{fieldError}</p>}
    </div>
  );
}
