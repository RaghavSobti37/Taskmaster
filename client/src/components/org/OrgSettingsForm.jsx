import React, { useEffect, useMemo, useState } from 'react';
import { Input, Button } from '../ui/primitives';
import OrgLogoPicker from '../../pages/org/create/OrgLogoPicker';
import {
  CURRENCY_OPTIONS,
  INDUSTRY_OPTIONS,
  slugifyOrgSlug,
  TEAM_SIZE_OPTIONS,
  TENANT_DATE_FORMAT_OPTIONS,
  TIMEZONE_OPTIONS,
} from '../../constants/orgCreateOptions';
import { tenantToOrgSettingsForm } from '../../hooks/queries/orgSettings';
import { useUnsavedChanges, stableJsonEqual } from '../../hooks/useUnsavedChanges';

const selectClass =
  'w-full rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-action-primary)] outline-none';

function FieldSelect({ id, label, value, onChange, options, placeholder, required = true, disabled = false }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block tm-section-label">
        {label}
      </label>
      <select
        id={id}
        className={selectClass}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}{opt.example ? ` · ${opt.example}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

function validateForm(form) {
  if (!String(form.name || '').trim()) return 'Organization name is required';
  if (!form.slugLocked) {
    const slug = slugifyOrgSlug(form.slug || form.name);
    if (!slug) return 'Enter a valid URL slug';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return 'Slug can only use lowercase letters, numbers, and hyphens';
    }
  }
  if (!form.industry) return 'Select an industry';
  if (!form.teamSize) return 'Select a team size';
  if (!form.timezone) return 'Select a timezone';
  if (!form.currency) return 'Select a currency';
  if (!form.dateFormat) return 'Select a date format';
  return '';
}

export default function OrgSettingsForm({ tenant, onSave, saving = false, readOnly = false }) {
  const baseline = useMemo(() => tenantToOrgSettingsForm(tenant), [tenant]);
  const [form, setForm] = useState(baseline);
  const [fieldError, setFieldError] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setForm(baseline);
  }, [baseline]);

  const hasChanges = !stableJsonEqual(form, baseline);

  const handleSave = async () => {
    if (readOnly) return;
    const err = validateForm(form);
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError('');
    setSaveError('');
    try {
      await onSave(form);
    } catch (e) {
      setSaveError(e.response?.data?.error || e.message || 'Could not save organization settings');
    }
  };

  useUnsavedChanges({
    hasChanges: readOnly ? false : hasChanges,
    onSave: handleSave,
    onCancel: () => setForm(baseline),
    isSaving: saving,
  });

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onNameChange = (e) => {
    const name = e.target.value;
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slugLocked ? prev.slug : slugifyOrgSlug(name),
    }));
    setFieldError('');
  };

  const onSlugChange = (e) => {
    setForm((prev) => ({
      ...prev,
      slug: slugifyOrgSlug(e.target.value),
    }));
    setFieldError('');
  };

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <section className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Identity</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Name, slug, and logo for your organization.</p>
        </div>

        <OrgLogoPicker
          name={form.name}
          logoUrl={form.logoUrl}
          onChange={(logoUrl) => setForm((prev) => ({ ...prev, logoUrl }))}
          onError={setFieldError}
          disabled={readOnly}
        />

        <Input
          label="Organization name"
          value={form.name}
          onChange={onNameChange}
          required
          disabled={readOnly}
          placeholder="The Shakti Collective"
        />

        <div className="space-y-2">
          <label htmlFor="org-settings-slug" className="block tm-section-label">
            URL slug
          </label>
          <div className={`flex items-center gap-0 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] ${form.slugLocked ? 'opacity-70' : 'focus-within:border-[var(--color-action-primary)]'}`}>
            <span className="shrink-0 border-r border-[var(--color-bg-border)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
              coreknot.app/
            </span>
            <input
              id="org-settings-slug"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none disabled:cursor-not-allowed"
              value={form.slug}
              onChange={onSlugChange}
              placeholder="your-org"
              disabled={readOnly || form.slugLocked}
              readOnly={readOnly || form.slugLocked}
              aria-describedby="org-settings-slug-hint"
            />
          </div>
          <p id="org-settings-slug-hint" className="text-[10px] text-[var(--color-text-muted)]">
            {form.slugLocked
              ? 'Slug is set and cannot be changed.'
              : 'Lowercase letters, numbers, and hyphens only.'}
          </p>
        </div>
      </section>

      <section className="space-y-6 border-t border-[var(--color-bg-border)] pt-8">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Profile</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Defaults for timezone, currency, and dates.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSelect
            id="org-settings-industry"
            label="Industry"
            value={form.industry}
            onChange={set('industry')}
            options={INDUSTRY_OPTIONS}
            placeholder="Select industry"
            disabled={readOnly}
          />
          <FieldSelect
            id="org-settings-team-size"
            label="Team size"
            value={form.teamSize}
            onChange={set('teamSize')}
            options={TEAM_SIZE_OPTIONS}
            placeholder="Select team size"
            disabled={readOnly}
          />
          <FieldSelect
            id="org-settings-timezone"
            label="Timezone"
            value={form.timezone}
            onChange={set('timezone')}
            options={TIMEZONE_OPTIONS}
            placeholder={null}
            disabled={readOnly}
          />
          <FieldSelect
            id="org-settings-currency"
            label="Currency"
            value={form.currency}
            onChange={set('currency')}
            options={CURRENCY_OPTIONS}
            placeholder={null}
            disabled={readOnly}
          />
          <div className="sm:col-span-2">
            <FieldSelect
              id="org-settings-date-format"
              label="Date format"
              value={form.dateFormat}
              onChange={set('dateFormat')}
              options={TENANT_DATE_FORMAT_OPTIONS}
              placeholder={null}
              disabled={readOnly}
            />
          </div>
        </div>
      </section>

      {(fieldError || saveError) && (
        <p className="text-xs text-rose-500" role="alert">
          {fieldError || saveError}
        </p>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-bg-border)] pt-6">
          <Button
            type="button"
            variant="ghost"
            disabled={!hasChanges || saving}
            onClick={() => setForm(baseline)}
          >
            Reset
          </Button>
          <Button type="submit" disabled={!hasChanges || saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      )}
    </form>
  );
}
