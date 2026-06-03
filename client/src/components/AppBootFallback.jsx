import React from 'react';

/** Minimal boot fallback — avoids heavy dashboard grid skeleton on auth/bootstrap. */
export default function AppBootFallback() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[var(--color-bg-workspace)]"
      role="status"
      aria-label="Loading"
    >
      <div className="h-8 w-8 rounded-full border-2 border-[var(--color-bg-border)] border-t-[var(--color-brand-teal)] animate-spin" />
    </div>
  );
}
