import React from 'react';
import {
  ORG_FEATURE_KEYS,
  ORG_FEATURE_CATALOG,
} from '@shared/orgFeatures';
import {
  CURRENCY_OPTIONS,
  INDUSTRY_OPTIONS,
  TEAM_SIZE_OPTIONS,
  TIMEZONE_OPTIONS,
  labelForOption,
  orgInitials,
} from '../../../../constants/orgCreateOptions';
function ReviewRow({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--color-text-primary)] sm:text-right">{children}</dd>
    </div>
  );
}

export default function StepReview({ form }) {
  const filledInvites = (form.invites || []).filter((r) => String(r.email || '').trim());
  const enabledFeatures = ORG_FEATURE_KEYS.filter((key) => form.features?.[key]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Review and create</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Confirm details before creating your organization.</p>
      </div>

      <div className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-5">
        <div className="mb-4 flex items-center gap-3 border-b border-[var(--color-bg-border)] pb-4">
          {form.logoUrl ? (
            <img src={form.logoUrl} alt="" className="h-12 w-12 rounded-lg border border-[var(--color-bg-border)] object-cover" />
          ) : (
            <span className="tm-org-avatar flex h-12 w-12 items-center justify-center text-sm">
              {orgInitials(form.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[var(--color-text-primary)]">{form.name}</p>
            <p className="truncate text-xs text-[var(--color-text-muted)]">coreknot.app/{form.slug}</p>
          </div>
        </div>

        <dl className="space-y-3">
          <ReviewRow label="Industry">{labelForOption(INDUSTRY_OPTIONS, form.industry)}</ReviewRow>
          <ReviewRow label="Team size">{labelForOption(TEAM_SIZE_OPTIONS, form.teamSize)}</ReviewRow>
          <ReviewRow label="Timezone">{labelForOption(TIMEZONE_OPTIONS, form.timezone)}</ReviewRow>
          <ReviewRow label="Currency">{labelForOption(CURRENCY_OPTIONS, form.currency)}</ReviewRow>
          <ReviewRow label="Features">
            {enabledFeatures.length === 0
              ? 'Core only'
              : enabledFeatures.map((key) => ORG_FEATURE_CATALOG[key].label).join(', ')}
          </ReviewRow>
          <ReviewRow label="Invites">            {filledInvites.length === 0
              ? 'None — you can invite later'
              : `${filledInvites.length} teammate${filledInvites.length === 1 ? '' : 's'}`}
          </ReviewRow>
        </dl>

        {filledInvites.length > 0 && (
          <ul className="mt-4 space-y-1 border-t border-[var(--color-bg-border)] pt-4 text-xs text-[var(--color-text-secondary)]">
            {filledInvites.map((row) => (
              <li key={row.email} className="flex justify-between gap-2">
                <span className="truncate">{row.email}</span>
                <span className="shrink-0 capitalize text-[var(--color-text-muted)]">{row.role}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
