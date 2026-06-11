import React from 'react';
import { ArrowLeftRight, Building2, Home } from 'lucide-react';

const MODE_LABELS = {
  office: 'Office',
  wfh: 'WFH',
};

const WorkModeToggle = ({
  value = 'office',
  onChange,
  disabled = false,
  compact = false,
  className = '',
}) => {
  const isOffice = value === 'office';
  const label = MODE_LABELS[value] || MODE_LABELS.office;
  const nextLabel = isOffice ? 'WFH' : 'Office';

  const handleClick = () => {
    if (disabled || !onChange) return;
    onChange(isOffice ? 'wfh' : 'office');
  };

  const accentClass = isOffice
    ? 'border-[color-mix(in_srgb,var(--color-action-primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-action-primary)_10%,transparent)]'
    : 'border-[color-mix(in_srgb,var(--color-pastel-violet-text)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-pastel-violet-text)_10%,transparent)]';
  const iconClass = isOffice
    ? 'bg-[color-mix(in_srgb,var(--color-action-primary)_18%,transparent)] text-[var(--color-action-primary)]'
    : 'bg-[color-mix(in_srgb,var(--color-pastel-violet-text)_18%,transparent)] text-[var(--color-pastel-violet-text)]';
  const labelClass = isOffice
    ? 'text-[var(--color-action-primary)]'
    : 'text-[var(--color-pastel-violet-text)]';

  if (compact) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={!isOffice}
        aria-label={`Work mode: ${label}. Tap to switch between Office and WFH.`}
        disabled={disabled}
        onClick={handleClick}
        className={[
          'group inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-atomic)] border px-3 py-2 min-h-10 text-xs transition-all',
          disabled
            ? 'cursor-not-allowed opacity-50 border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]'
            : 'cursor-pointer hover:brightness-[1.02] active:scale-[0.99]',
          accentClass,
          labelClass,
          className,
        ].join(' ')}
      >
        {isOffice ? <Building2 size={14} className="shrink-0" aria-hidden /> : <Home size={14} className="shrink-0" aria-hidden />}
        <span className="font-bold">{label}</span>
        {!disabled && <ArrowLeftRight size={13} className="shrink-0 opacity-70" aria-hidden />}
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!isOffice}
      aria-label={`Work mode: ${label}. Tap to switch to ${nextLabel}.`}
      disabled={disabled}
      onClick={handleClick}
      className={[
        'group flex w-full items-center justify-between gap-3 rounded-[var(--radius-atomic)] border px-3.5 sm:px-4 min-h-[44px] py-2.5 transition-all',
        disabled
          ? 'cursor-not-allowed opacity-50 border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]'
          : 'cursor-pointer hover:brightness-[1.02] active:scale-[0.995]',
        accentClass,
        className,
      ].join(' ')}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
          aria-hidden
        >
          {isOffice ? <Building2 size={18} strokeWidth={2.25} /> : <Home size={18} strokeWidth={2.25} />}
        </span>
        <span className={`font-bold text-sm sm:text-base truncate ${labelClass}`}>{label}</span>
      </div>
      {!disabled && (
        <span className="inline-flex items-center gap-1.5 shrink-0 text-[var(--color-text-muted)]">
          <span className="hidden sm:inline text-[10px] font-medium whitespace-nowrap">
            Tap to switch · {nextLabel}
          </span>
          <span className="sm:hidden text-[10px] font-medium whitespace-nowrap">Switch</span>
          <ArrowLeftRight
            size={15}
            className="opacity-70 group-hover:opacity-100 transition-opacity"
            aria-hidden
          />
        </span>
      )}
    </button>
  );
};

export default WorkModeToggle;
