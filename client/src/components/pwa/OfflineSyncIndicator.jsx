import { useSyncStatus } from '@coreknot/sync-client/react';

const LABELS = {
  idle: null,
  connecting: 'Connecting…',
  syncing: 'Syncing…',
  synced: null,
  offline: 'Offline — changes saved locally',
  error: 'Sync issue — retrying',
};

export default function OfflineSyncIndicator() {
  const status = useSyncStatus();
  const label = LABELS[status] ?? null;

  if (!label) return null;

  return (
    <div
      className="sr-only-focusable:not-sr-only fixed top-2 left-1/2 z-[9998] -translate-x-1/2 rounded-full bg-[var(--brand-espresso)] px-3 py-1 text-xs text-white"
      role="status"
      aria-live="polite"
      id="system-announcements-container"
    >
      {label}
    </div>
  );
}
