import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  acceptAllCookies,
  readCookieConsent,
  rejectOptionalCookies,
} from '../lib/cookieConsent';
import { readMotionMs } from '../hooks/transitions';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const needsConsent = !readCookieConsent();
    setVisible(needsConsent);
    if (needsConsent) {
      requestAnimationFrame(() => setOpen(true));
    }
  }, []);

  const dismiss = () => {
    setOpen(false);
    const ms = readMotionMs('--panel-close-dur', 350);
    setTimeout(() => setVisible(false), ms);
  };

  if (!visible) return null;

  return (
    <div
      className="t-panel-slide fixed bottom-4 left-4 right-4 z-[200] mx-auto max-w-lg sm:left-auto"
      data-open={open ? 'true' : 'false'}
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <p className="text-sm font-bold text-foreground mb-1">Cookies on CoreKnot</p>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-4">
          Session cookies keep you signed in. Optional analytics use Vercel Analytics and PostHog (product usage only).
          {' '}
          <Link to="/privacy" className="underline text-[var(--color-brand-teal)]">
            Privacy policy
          </Link>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="flex-1 min-w-[8rem] rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-background transition"
            onClick={() => {
              rejectOptionalCookies();
              dismiss();
            }}
          >
            Essential only
          </button>
          <button
            type="button"
            className="flex-1 min-w-[8rem] rounded-xl bg-[var(--color-brand-teal)] px-3 py-2 text-xs font-bold text-[var(--color-brand-cream)] hover:opacity-90 transition"
            onClick={() => {
              acceptAllCookies();
              dismiss();
            }}
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
