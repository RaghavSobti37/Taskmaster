import React, { useEffect, useRef } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { Card } from '../../../components/ui';
import BrandLogo from '../../../components/brand/BrandLogo';
import { useAcceptArtistMembership } from '../../../hooks/queries/artistMembers';

function classifyAcceptError(message = '') {
  const lower = message.toLowerCase();
  if (lower.includes('already accepted') || lower.includes('not found or already')) {
    return 'already_accepted';
  }
  if (lower.includes('not found') || lower.includes('invalid') || lower.includes('required')) {
    return 'invalid_token';
  }
  return 'generic';
}

const ERROR_COPY = {
  missing_token: {
    title: 'Invalid invitation link',
    body: 'This link is missing an invitation token. Ask the workspace owner to send a new invite.',
    icon: AlertCircle,
    iconClass: 'text-rose-500',
  },
  invalid_token: {
    title: 'Invitation not found',
    body: 'This invitation link is invalid or has expired. Ask the workspace owner for a new invite.',
    icon: AlertCircle,
    iconClass: 'text-rose-500',
  },
  already_accepted: {
    title: 'Already accepted',
    body: 'You have already joined this artist workspace. Open the workspace to continue.',
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
  },
  generic: {
    title: 'Could not accept invitation',
    body: null,
    icon: AlertCircle,
    iconClass: 'text-rose-500',
  },
};

export default function ArtistMembershipAccept() {
  const { id: artistId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { mutate, isPending } = useAcceptArtistMembership();
  const attemptedRef = useRef(false);

  const [errorState, setErrorState] = React.useState(() => (
    token ? null : { reason: 'missing_token', message: null }
  ));

  useEffect(() => {
    if (!token || attemptedRef.current) return;
    attemptedRef.current = true;

    mutate(
      { artistId, token },
      {
        onSuccess: (data) => {
          const redirectUrl = data?.redirectUrl || `/artist-workspace/${artistId}`;
          navigate(redirectUrl, { replace: true });
        },
        onError: (err) => {
          const message = err.response?.data?.message || err.message || 'Could not accept invitation';
          setErrorState({ reason: classifyAcceptError(message), message });
        },
      },
    );
  }, [artistId, token, mutate, navigate]);

  const workspacePath = `/artist-workspace/${artistId}`;

  if (errorState) {
    const copy = ERROR_COPY[errorState.reason] || ERROR_COPY.generic;
    const Icon = copy.icon;
    const showWorkspaceLink = errorState.reason === 'already_accepted';

    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-workspace)] px-4">
        <Card className="max-w-md w-full p-8 rounded-2xl text-center space-y-4">
          <div className="flex justify-center">
            <BrandLogo size={36} />
          </div>
          <div className="mx-auto w-12 h-12 rounded-xl bg-[var(--token-surface-2)] flex items-center justify-center">
            <Icon size={22} className={copy.iconClass} />
          </div>
          <h1 className="text-lg font-black text-[var(--color-text-primary)]">{copy.title}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {copy.body || errorState.message}
          </p>
          <div className="flex flex-col gap-2 pt-1">
            {showWorkspaceLink && (
              <Link
                to={workspacePath}
                className="inline-flex w-full items-center justify-center rounded-[var(--radius-atomic)] px-4 py-2 text-sm font-semibold bg-[var(--color-accent-primary)] text-white hover:opacity-90"
              >
                Open workspace
              </Link>
            )}
            <Link
              to="/dashboard"
              className="inline-flex w-full items-center justify-center rounded-[var(--radius-atomic)] px-4 py-2 text-sm font-semibold bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-border)]"
            >
              Back to dashboard
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-workspace)] px-4">
      <Card className="max-w-md w-full p-8 rounded-2xl text-center space-y-4">
        <div className="flex justify-center">
          <BrandLogo size={36} />
        </div>
        <div className="mx-auto w-12 h-12 rounded-xl bg-[var(--token-surface-2)] flex items-center justify-center">
          {isPending ? (
            <Loader2 size={22} className="animate-spin text-[var(--color-accent-primary)]" />
          ) : (
            <Mail size={22} className="text-[var(--color-accent-primary)]" />
          )}
        </div>
        <h1 className="text-lg font-black text-[var(--color-text-primary)]">Accepting invitation</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Joining this artist workspace. You will be redirected in a moment.
        </p>
      </Card>
    </div>
  );
}
