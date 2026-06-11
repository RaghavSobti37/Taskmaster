import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { Card } from '../../../components/ui';
import BrandLogo from '../../../components/brand/BrandLogo';

export default function ArtistWorkspaceNoAccess({ reason = 'denied' }) {
  const isPending = reason === 'pending';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-workspace)] px-4">
      <Card className="max-w-md w-full p-8 rounded-2xl text-center space-y-4">
        <div className="flex justify-center">
          <BrandLogo size={36} />
        </div>
        <div className="mx-auto w-12 h-12 rounded-xl bg-[var(--token-surface-2)] flex items-center justify-center">
          {isPending ? <Mail size={22} className="text-amber-500" /> : <Lock size={22} className="text-rose-500" />}
        </div>
        <h1 className="text-lg font-black text-[var(--color-text-primary)]">
          {isPending ? 'Invitation pending' : 'No workspace access'}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {isPending
            ? 'Accept your team invitation to open this artist workspace.'
            : 'You are not on this artist team. Ask the owner for an invite.'}
        </p>
        <Link
          to="/dashboard"
          className="inline-flex w-full items-center justify-center rounded-[var(--radius-atomic)] px-4 py-2 text-sm font-semibold bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-border)]"
        >
          Back to dashboard
        </Link>
      </Card>
    </div>
  );
}
