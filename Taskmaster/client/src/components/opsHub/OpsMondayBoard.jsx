import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { Button } from '../ui/primitives';
import { useSubmitOpsWeekly } from '../../hooks/queries/opsHub';
import { useToast } from '../../contexts/ToastContext';

export default function OpsMondayBoard({ weekKey, sections = [], canSubmitDomain }) {
  const submit = useSubmitOpsWeekly();
  const toast = useToast();

  const handleSubmit = async (domain) => {
    try {
      await submit.mutateAsync({ domain, weekKey });
      toast.success(`${domain} marked submitted for ${weekKey}`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--token-surface-1)] p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
        Weekly check-in — {weekKey}
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((section) => {
          const submitted = section.submitted;
          const canSubmit = canSubmitDomain?.(section.domain);
          return (
            <div
              key={section.domain}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-bg-border)] px-3 py-2"
              style={{ borderLeftWidth: 3, borderLeftColor: section.color || 'var(--color-action-primary)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {submitted ? (
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-500" aria-hidden />
                ) : (
                  <Circle size={16} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden />
                )}
                <span className="text-xs font-bold truncate">{section.label}</span>
              </div>
              {!submitted && canSubmit ? (
                <Button size="sm" variant="secondary" onClick={() => handleSubmit(section.domain)} disabled={submit.isPending}>
                  Submit
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
