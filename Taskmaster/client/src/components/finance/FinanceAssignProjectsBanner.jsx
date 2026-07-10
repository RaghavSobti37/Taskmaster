import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

const STORAGE_KEY = 'coreknot:finance-assign-banner-dismissed';

export default function FinanceAssignProjectsBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ponytail: localStorage optional */
    }
  };

  return (
    <div className="relative rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 pr-10 text-xs text-[var(--color-text-primary)]">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
        aria-label="Dismiss banner"
      >
        <X size={14} />
      </button>
      Project analytics uses finance doc project + amount fields.
      {' '}
      Run
      {' '}
      <Link to="/admin/scripts" className="font-semibold text-amber-600 hover:underline">
        Assign Finance to Projects
      </Link>
      {' '}
      in Script Runner to map unassigned docs (uncertain → General).
      Reparse OCR if amounts are missing.
    </div>
  );
}
