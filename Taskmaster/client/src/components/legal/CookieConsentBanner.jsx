import { useEffect, useState } from 'react';
import { acceptAllCookies, readCookieConsent } from '../../lib/cookieConsent';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!readCookieConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] border-t border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] p-4 shadow-lg">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--color-text-muted)]">
          CoreKnot uses cookies for authentication and preferences.
        </p>
        <button
          type="button"
          className="rounded-lg bg-[var(--color-action-primary)] px-4 py-2 text-xs font-medium text-white"
          onClick={() => {
            acceptAllCookies();
            setVisible(false);
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
