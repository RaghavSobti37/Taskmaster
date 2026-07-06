import React, { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/primitives';

const AUTO_REDIRECT_MS = 2500;

export default function OrgCreateSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectedRef = useRef(false);

  const {
    orgName = 'Your organization',
    invitesSent = false,
  } = location.state || {};

  const goToDashboard = useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    navigate('/dashboard', {
      replace: true,
      state: { fromOrgCreate: true, invitesSent: Boolean(invitesSent), orgName },
    });
  }, [navigate, orgName, invitesSent]);

  useEffect(() => {
    const timer = window.setTimeout(goToDashboard, AUTO_REDIRECT_MS);
    return () => window.clearTimeout(timer);
  }, [goToDashboard]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-base)] p-6">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] p-8 text-center">
        <CheckCircle2
          className="mx-auto h-12 w-12 text-emerald-500"
          strokeWidth={1.75}
          aria-hidden
        />
        <h1 className="mt-4 text-xl font-semibold text-[var(--color-text-primary)]">
          {orgName} is ready
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Taking you to your dashboard…
        </p>
        <Button type="button" className="mt-6 w-full" onClick={goToDashboard}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
