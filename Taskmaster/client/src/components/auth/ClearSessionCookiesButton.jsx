import React, { useState } from 'react';
import {
  resetAuthSession,
  shouldOfferSessionReset,
} from '../../utils/authSessionReset';

const panelBtnClass =
  'text-xs text-white/75 underline-offset-2 hover:text-white hover:underline transition-colors disabled:opacity-60 disabled:pointer-events-none';

const footerBtnClass =
  'text-[11px] text-[var(--brand-teal-mid)]/80 font-medium underline-offset-2 hover:text-[var(--brand-green)] hover:underline transition-colors disabled:opacity-60 disabled:pointer-events-none';

/**
 * Clears stale CoreKnot + Clerk session cookies.
 * @param {'panel'|'footer'} variant — panel: login troubleshooting; footer: always visible legal row
 */
export default function ClearSessionCookiesButton({
  bootError = false,
  stuckLogin = false,
  variant = 'panel',
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const isFooter = variant === 'footer';

  // Always show the button when there's an error or user is stuck
  const shouldShowPanel = isFooter || (!done && (bootError || stuckLogin || showTroubleshoot || shouldOfferSessionReset({ bootError, stuckLogin })));

  if (!shouldShowPanel) return null;

  if (!isFooter && done) {
    return (
      <div className="mt-4 pt-4 border-t border-white/15 text-center">
        <p className="text-[11px] leading-relaxed text-teal-100/70">
          Session cookies cleared. The page will reload — please try signing in again.
        </p>
      </div>
    );
  }

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await resetAuthSession();
      if (!isFooter) setDone(true);
      window.location.replace(`${window.location.pathname}${window.location.search}`);
    } catch {
      setBusy(false);
    }
  };

  const label = busy ? 'Clearing…' : (isFooter ? 'Clear cookies' : 'Clear old session cookies');

  if (isFooter) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={footerBtnClass}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/15 text-center">
      <p className="text-[11px] leading-relaxed text-white/60 mb-2">
        {bootError
          ? 'The app could not load your session. Clearing old cookies may help.'
          : stuckLogin
            ? 'Stuck in a sign-in loop? Old session cookies can block a fresh login.'
            : 'Stuck after sign-in? Old session cookies can block a fresh login.'}
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={panelBtnClass}
      >
        {label}
      </button>
      {!showTroubleshoot && !bootError && !stuckLogin ? (
        <p className="mt-2">
          <button
            type="button"
            onClick={() => setShowTroubleshoot(true)}
            className="text-[11px] text-white/50 hover:text-white/80 underline-offset-2 hover:underline transition-colors"
          >
            Still having trouble?
          </button>
        </p>
      ) : null}
    </div>
  );
}
