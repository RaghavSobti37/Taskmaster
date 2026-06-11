import React from 'react';
import { CheckCircle2, Circle, LogIn, Link2 } from 'lucide-react';
import { Card, Button } from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';
import { saveAuthReturnPath } from '../../../lib/authUnauthorized';
import { isUserOnArtistTeam } from '../../../utils/artistTeamAccess';
import ConnectAccountButton from '../../../components/artists/ConnectAccountButton';

const PLATFORMS = ['spotify', 'youtube', 'instagram'];

export default function ArtistConnectOnboarding({
  artistId,
  shareToken,
  team = [],
  connections = [],
  isPreview,
}) {
  const { user } = useAuth();

  if (!isPreview) return null;

  const signedIn = !!user;
  const claimed = isUserOnArtistTeam(user, team);
  const connectedCount = connections.filter((c) => c.accountHandle || c.status === 'active').length;
  const allConnected = connectedCount >= PLATFORMS.length;

  const steps = [
    { id: 'signin', label: 'Sign in to your account', done: signedIn },
    { id: 'claim', label: 'Claim this workspace', done: claimed },
    { id: 'connect', label: 'Connect Spotify, YouTube & Instagram', done: allConnected },
  ];

  return (
    <Card className="p-5 rounded-2xl border-indigo-500/30 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 space-y-4">
      <div>
        <h3 className="text-sm font-black text-[var(--color-text-primary)]">Get started in 3 steps</h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Connect your accounts so your team can track growth, gigs, and bookings.
        </p>
      </div>

      <ol className="space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-xs font-bold">
            {step.done ? (
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            ) : (
              <Circle size={16} className="text-slate-400 shrink-0" />
            )}
            <span className={step.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--color-text-muted)]'}>
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      {!signedIn && shareToken && (
        <Button
          size="sm"
          onClick={() => {
            saveAuthReturnPath();
            const returnPath = `${window.location.pathname}${window.location.search}`;
            window.location.href = `/login?redirect=${encodeURIComponent(returnPath)}`;
          }}
        >
          <LogIn size={14} /> Sign in
        </Button>
      )}

      {signedIn && claimed && !allConnected && (
        <div className="flex flex-wrap gap-2 pt-1">
          {PLATFORMS.map((provider) => {
            const conn = connections.find((c) => c.provider === provider);
            const done = !!(conn?.accountHandle || conn?.status === 'active');
            if (done) return null;
            return (
              <ConnectAccountButton key={provider} provider={provider} artistId={artistId} variant="compact" />
            );
          })}
        </div>
      )}

      {allConnected && (
        <p className="text-xs font-bold text-emerald-500 flex items-center gap-1">
          <Link2 size={14} /> All platforms connected — your team can sync analytics anytime.
        </p>
      )}
    </Card>
  );
}
