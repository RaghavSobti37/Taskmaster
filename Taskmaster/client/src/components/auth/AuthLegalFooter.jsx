import React from 'react';
import { Link } from 'react-router-dom';
import ClearSessionCookiesButton from './ClearSessionCookiesButton';

/** Small legal row below auth card — low visual weight. */
export default function AuthLegalFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-[var(--brand-teal-mid)]/80 font-medium">
      <Link to="/privacy" className="hover:text-[var(--brand-green)] transition-colors">
        Privacy Policy
      </Link>
      <span aria-hidden className="opacity-40">·</span>
      <Link to="/userdata" className="hover:text-[var(--brand-green)] transition-colors">
        User Data Deletion
      </Link>
      <span aria-hidden className="opacity-40">·</span>
      <ClearSessionCookiesButton variant="footer" />
    </footer>
  );
}
