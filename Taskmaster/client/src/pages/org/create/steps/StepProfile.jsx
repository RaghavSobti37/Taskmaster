import React from 'react';
import {
  CURRENCY_OPTIONS,
  INDUSTRY_OPTIONS,
  TEAM_SIZE_OPTIONS,
  TENANT_DATE_FORMAT_OPTIONS,
  TIMEZONE_OPTIONS,
} from '../../../../constants/orgCreateOptions';

const selectClass =
  'w-full rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-action-primary)] outline-none';

function FieldSelect({ id, label, value, onChange, options, placeholder }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block tm-section-label">
        {label}
      </label>
      <select id={id} className={selectClass} value={value} onChange={onChange} required>
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

export default function StepProfile({ form, setForm, fieldError }) {
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Organization profile</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Defaults for timezone, currency, and dates.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldSelect
          id="org-industry"
          label="Industry"
          value={form.industry}
          onChange={set('industry')}
          options={INDUSTRY_OPTIONS}
          placeholder="Select industry"
        />
        <FieldSelect
          id="org-team-size"
          label="Team size"
          value={form.teamSize}
          onChange={set('teamSize')}
          options={TEAM_SIZE_OPTIONS}
          placeholder="Select team size"
        />
        <FieldSelect
          id="org-timezone"
          label="Timezone"
          value={form.timezone}
          onChange={set('timezone')}
          options={TIMEZONE_OPTIONS}
        />
        <FieldSelect
          id="org-currency"
          label="Currency"
          value={form.currency}
          onChange={set('currency')}
          options={CURRENCY_OPTIONS}
        />
        <div className="sm:col-span-2">
          <FieldSelect
            id="org-date-format"
            label="Date format"
            value={form.dateFormat}
            onChange={set('dateFormat')}
            options={TENANT_DATE_FORMAT_OPTIONS}
          />
        </div>
      </div>

      {fieldError && <p className="text-xs text-rose-500">{fieldError}</p>}
    </div>
  );
}
