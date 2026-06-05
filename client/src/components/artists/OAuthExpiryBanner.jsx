import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui';

const PROVIDER_LABELS = {
  spotify: 'Spotify',
  youtube: 'YouTube',
  instagram: 'Instagram',
  meta: 'Meta',
  facebook: 'Facebook',
};

export default function OAuthExpiryBanner({ expiredConnections = [], onReconnect }) {
  if (!expiredConnections.length) return null;

  const labels = expiredConnections
    .map((c) => PROVIDER_LABELS[c.provider] || c.provider)
    .join(', ');

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-[var(--color-bg-secondary)] px-4 py-3">
      <AlertTriangle size={16} className="text-amber-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-[var(--color-text-primary)]">
          Connection expired — {labels}
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
          Charts may show dashed projections until you reconnect.
        </p>
      </div>
      {onReconnect && (
        <Button variant="secondary" size="xs" onClick={onReconnect}>
          <RefreshCw size={12} /> Reconnect
        </Button>
      )}
    </div>
  );
}
