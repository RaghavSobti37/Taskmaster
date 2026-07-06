import React from 'react';
import { ORG_CREATE_STEPS } from '../../../constants/orgCreateOptions';

export default function OrgCreateProgress({ step }) {
  return (
    <nav aria-label="Organization setup progress" className="w-full">
      <ol className="flex items-center gap-2">
        {ORG_CREATE_STEPS.map((s, idx) => {
          const done = step > s.id;
          const active = step === s.id;
          return (
            <li key={s.id} className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span
                  className={`
                    flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors
                    ${done ? 'bg-[var(--color-action-primary)] text-[var(--color-bg-primary)]' : ''}
                    ${active ? 'border-2 border-[var(--color-action-primary)] text-[var(--color-action-primary)]' : ''}
                    ${!done && !active ? 'border border-[var(--color-bg-border)] text-[var(--color-text-muted)]' : ''}
                  `}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? '✓' : s.id}
                </span>
                <span
                  className={`truncate text-[10px] font-semibold uppercase tracking-wide ${active ? 'text-[var(--color-action-primary)]' : 'text-[var(--color-text-muted)]'}`}
                >
                  {s.label}
                </span>
              </div>
              {idx < ORG_CREATE_STEPS.length - 1 && (
                <div
                  className={`mb-5 h-px flex-1 ${done ? 'bg-[var(--color-action-primary)]' : 'bg-[var(--color-bg-border)]'}`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
