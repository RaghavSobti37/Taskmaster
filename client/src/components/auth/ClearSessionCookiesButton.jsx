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
  const isFooter = variant === 'footer';

  if (!isFooter && (done || !shouldOfferSessionReset({ bootError, stuckLogin }))) {
    return null;
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
        Stuck after sign-in? Old session cookies can block a fresh login.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={panelBtnClass}
      >
        {label}
      </button>
    </div>
  );
}
