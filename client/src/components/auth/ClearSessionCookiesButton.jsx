import React, { useState } from 'react';
import {
  resetAuthSession,
  shouldOfferSessionReset,
} from '../../utils/authSessionReset';

const btnClass =
  'text-xs text-white/75 underline-offset-2 hover:text-white hover:underline transition-colors disabled:opacity-60 disabled:pointer-events-none';

/**
 * One-time troubleshooting control — clears stale CoreKnot + Clerk session cookies.
 */
export default function ClearSessionCookiesButton({ bootError = false }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done || !shouldOfferSessionReset({ bootError })) {
    return null;
  }

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await resetAuthSession();
      setDone(true);
      window.location.replace(`${window.location.pathname}${window.location.search}`);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-white/15 text-center">
      <p className="text-[11px] leading-relaxed text-white/60 mb-2">
        Stuck after sign-in? Old session cookies can block a fresh login.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={btnClass}
      >
        {busy ? 'Clearing session…' : 'Clear old session cookies'}
      </button>
    </div>
  );
}
