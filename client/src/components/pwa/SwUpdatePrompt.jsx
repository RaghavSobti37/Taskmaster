import { useEffect, useState } from 'react';
import { postSwUpdateMessage, subscribeSwUpdateMessages } from '../../lib/swUpdateChannel';

/**
 * Prompts user before skipWaiting — enterprise PWA update coordination.
 */
export default function SwUpdatePrompt({ onNeedRefresh, offlineReady }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (onNeedRefresh) setVisible(true);
  }, [onNeedRefresh]);

  useEffect(() => {
    return subscribeSwUpdateMessages((message) => {
      if (message?.type === 'refresh-all') {
        window.location.reload();
      }
    });
  }, []);

  if (!visible || !onNeedRefresh) return null;

  const applyUpdate = () => {
    postSwUpdateMessage('skip-waiting');
    onNeedRefresh();
    setVisible(false);
    window.setTimeout(() => {
      postSwUpdateMessage('refresh-all');
      window.location.reload();
    }, 300);
  };

  return (
    <div
      className="tm-floating fixed bottom-20 left-1/2 z-[9999] flex max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-[var(--token-hairline)] bg-[var(--token-surface-1)] px-4 py-3 shadow-lg md:bottom-6"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-[var(--token-text-primary)]">
        {offlineReady ? 'CoreKnot update ready.' : 'New version available.'}
      </p>
      <button
        type="button"
        className="interactive-action-trigger rounded-lg bg-[var(--brand-green)] px-3 py-2 text-sm font-medium text-white"
        onClick={applyUpdate}
      >
        Update
      </button>
      <button
        type="button"
        className="text-sm text-[var(--token-text-muted)]"
        onClick={() => setVisible(false)}
      >
        Later
      </button>
    </div>
  );
}
