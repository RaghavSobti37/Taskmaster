import React from 'react';
import { Input } from '../../../../components/ui/primitives';
import OrgLogoPicker from '../OrgLogoPicker';
import { slugifyOrgSlug } from '../../../../constants/orgCreateOptions';

export default function StepIdentity({ form, setForm, fieldError, setFieldError }) {
  const onNameChange = (e) => {
    const name = e.target.value;
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slugManual ? prev.slug : slugifyOrgSlug(name),
    }));
    setFieldError('');
  };

  const onSlugChange = (e) => {
    setForm((prev) => ({
      ...prev,
      slug: slugifyOrgSlug(e.target.value),
      slugManual: true,
    }));
    setFieldError('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Organization identity</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Name your organization and set a URL slug.</p>
      </div>

      <OrgLogoPicker
        name={form.name}
        logoUrl={form.logoUrl}
        onChange={(logoUrl) => setForm((prev) => ({ ...prev, logoUrl }))}
        onError={setFieldError}
      />

      <Input
        label="Organization name"
        value={form.name}
        onChange={onNameChange}
        autoFocus
        required
        placeholder="The Shakti Collective"
      />

      <div className="space-y-2">
        <label htmlFor="org-slug" className="block tm-section-label">
          URL slug
        </label>
        <div className="flex items-center gap-0 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] focus-within:border-[var(--color-action-primary)]">
          <span className="shrink-0 border-r border-[var(--color-bg-border)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            coreknot.app/
          </span>
          <input
            id="org-slug"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
            value={form.slug}
            onChange={onSlugChange}
            placeholder="your-org"
            aria-describedby="org-slug-hint"
          />
        </div>
        <p id="org-slug-hint" className="text-[10px] text-[var(--color-text-muted)]">
          Lowercase letters, numbers, and hyphens only.
        </p>
      </div>

      {fieldError && <p className="text-xs text-rose-500">{fieldError}</p>}
    </div>
  );
}
