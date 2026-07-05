import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsOfService() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-[var(--color-text-primary)]">
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">Last updated: 5 July 2026</p>
      <section className="mt-8 space-y-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        <p>
          These Terms govern your use of CoreKnot operated by The Shakti Collective. By creating an account or using the service, you agree to these Terms.
        </p>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Organizations</h2>
        <p>
          You may belong to one or more organizations. Organization owners and admins are responsible for invites, billing, and compliance within their workspace.
        </p>
        <p>
          See also our <Link to="/privacy" className="text-[var(--color-action-primary)] underline">Privacy Policy</Link>.
        </p>
      </section>
    </div>
  );
}
