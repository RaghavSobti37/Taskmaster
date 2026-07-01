import React from 'react';
import { Check } from 'lucide-react';

const STEPS = [
  { step: 1, label: 'Setup', hint: 'Name, subject & sender' },
  { step: 2, label: 'Template', hint: 'Pick approved email' },
  { step: 3, label: 'Audience', hint: 'Recipients & variables' },
  { step: 4, label: 'Pre-flight', hint: 'Preview & send' },
];

export default function WizardProgressBar({ currentStep, onStepClick }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-b border-[var(--color-bg-border)] pb-4">
      {STEPS.map(({ step, label, hint }) => {
        const done = currentStep > step;
        const active = currentStep === step;
        return (
          <button
            key={step}
            type="button"
            onClick={() => step < currentStep && onStepClick?.(step)}
            disabled={step > currentStep}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
              active
                ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]'
                : done
                  ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-600 cursor-pointer'
                  : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
            }`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
              active ? 'bg-[var(--color-action-primary)] text-white' : done ? 'bg-emerald-500 text-white' : 'bg-[var(--color-bg-primary)]'
            }`}>
              {done ? <Check size={12} /> : step}
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-wider">{label}</span>
              {(active || done) && (
                <span className="block text-[9px] font-normal normal-case tracking-normal opacity-80 truncate">
                  {hint}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
