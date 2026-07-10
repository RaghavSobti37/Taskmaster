import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  ORG_FEATURE_KEYS,
  ORG_FEATURE_CATALOG,
} from '@shared/orgFeatures';
import { Button } from '../ui/primitives';
import { useOrgOptional } from '../../contexts/OrgContext';

export default function OrgFeatureToggles({
  tenantId,
  canEdit,
  initialUnlocks = {},
  onSaved,
}) {
  const org = useOrgOptional();
  const [features, setFeatures] = useState(initialUnlocks);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setFeatures(initialUnlocks);
    setDirty(false);
  }, [initialUnlocks, tenantId]);

  const toggle = (key) => {
    if (!canEdit) return;
    setFeatures((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      setDirty(true);
      return next;
    });
  };

  const handleSave = async () => {
    if (!tenantId || !canEdit) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await axios.patch(
        `/api/tenants/${tenantId}/features`,
        { featureUnlocks: features },
        { withCredentials: true },
      );
      setFeatures(data.featureUnlocks || features);
      setDirty(false);
      org?.invalidate?.();
      onSaved?.(data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not save features');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-5">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Organization features</h3>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Enable or disable optional modules for this organization. Disabling hides access but keeps data.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ORG_FEATURE_KEYS.map((key) => {
          const meta = ORG_FEATURE_CATALOG[key];
          const checked = Boolean(features[key]);
          return (
            <label
              key={key}
              className={`flex gap-3 rounded-lg border p-3 ${
                canEdit ? 'cursor-pointer' : 'opacity-80'
              } ${checked ? 'border-[var(--color-action-primary)]/40' : 'border-[var(--color-bg-border)]'}`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--color-action-primary)]"
                checked={checked}
                disabled={!canEdit}
                onChange={() => toggle(key)}
              />
              <span>
                <span className="block text-sm font-medium text-[var(--color-text-primary)]">{meta.label}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{meta.description}</span>
              </span>
            </label>
          );
        })}
      </div>

      {error && <p className="text-xs text-rose-500">{error}</p>}

      {canEdit && (
        <Button type="button" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save features'}
        </Button>
      )}
    </section>
  );
}
