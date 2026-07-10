import React from 'react';
import {
  ORG_FEATURE_KEYS,
  ORG_FEATURE_CATALOG,
  defaultFeatureUnlocks,
} from '@shared/orgFeatures';

export default function StepFeatures({ form, setForm }) {
  const features = form.features || defaultFeatureUnlocks();

  const toggle = (key) => {
    setForm((prev) => ({
      ...prev,
      features: {
        ...(prev.features || defaultFeatureUnlocks()),
        [key]: !features[key],
      },
    }));
  };

  const enabledCount = ORG_FEATURE_KEYS.filter((key) => features[key]).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Choose features</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Turn on only what this organization needs. Core modules (dashboard, projects, calendar) are always included.
          {' '}
          {enabledCount}
          {' '}
          optional
          {enabledCount === 1 ? '' : 's'}
          {' '}
          selected.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ORG_FEATURE_KEYS.map((key) => {
          const meta = ORG_FEATURE_CATALOG[key];
          const checked = Boolean(features[key]);
          return (
            <label
              key={key}
              className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                checked
                  ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/5'
                  : 'border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] hover:border-[var(--color-text-muted)]'
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-action-primary)]"
                checked={checked}
                onChange={() => toggle(key)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--color-text-primary)]">{meta.label}</span>
                <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">{meta.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
