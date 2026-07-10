import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { EXLY_PAGE_LEGEND } from '../../utils/exlyCourseLabels';

const ExlyPageLegend = ({ className = '' }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        aria-expanded={open}
        aria-label={open ? 'Hide column guide' : 'What do these columns mean?'}
      >
        <HelpCircle size={13} aria-hidden />
        <span className="hidden sm:inline">
          {open ? 'Hide column guide' : 'What do these columns mean?'}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-[min(100vw-2rem,28rem)] rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] shadow-lg p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              Column guide
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              aria-label="Close column guide"
            >
              <X size={12} />
            </button>
          </div>
          <ul className="space-y-1.5 text-[10px] text-[var(--color-text-primary)]">
            {EXLY_PAGE_LEGEND.map((item) => (
              <li key={item.key} className="flex gap-1.5 min-w-0">
                <span className="font-black uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">
                  {item.label}
                </span>
                <span className="text-[var(--color-text-muted)]">—</span>
                <span>{item.hint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ExlyPageLegend;
