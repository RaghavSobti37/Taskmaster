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
  loading = false,
  compact = false,
  className = '',
  suggestedMode = null,
}) => {
  const isOffice = value === 'office';
  const label = MODE_LABELS[value] || MODE_LABELS.office;
  const hintMatches = suggestedMode === value && !loading && !disabled;

  const handleClick = () => {
    if (disabled || loading || !onChange) return;
    onChange(isOffice ? 'wfh' : 'office');
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={!isOffice}
        aria-label={`Work mode: ${label}. Tap to switch between Office and WFH.`}
        disabled={disabled || loading}
        onClick={handleClick}
        className={[
          'group inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-atomic)] border-2 px-3 transition-all',
          compact ? 'py-2 text-xs' : 'py-2.5 text-sm',
          disabled || loading
            ? 'cursor-not-allowed opacity-50 border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]'
            : 'cursor-pointer hover:brightness-[1.02] active:scale-[0.99]',
          isOffice
            ? 'border-[color-mix(in_srgb,var(--color-action-primary)_50%,transparent)] bg-[color-mix(in_srgb,var(--color-action-primary)_12%,transparent)] text-[var(--color-action-primary)]'
            : 'border-[color-mix(in_srgb,var(--color-pastel-violet-text)_50%,transparent)] bg-[color-mix(in_srgb,var(--color-pastel-violet-text)_12%,transparent)] text-[var(--color-pastel-violet-text)]',
        ].join(' ')}
      >
        {isOffice ? (
          <Building2
            size={compact ? 14 : 16}
            className={`shrink-0 transition-all duration-300 ${hintMatches ? 'scale-110 text-[var(--color-action-primary)]' : ''}`}
            aria-hidden
          />
        ) : (
          <Home
            size={compact ? 14 : 16}
            className={`shrink-0 transition-all duration-300 ${hintMatches ? 'scale-110 text-[var(--color-pastel-violet-text)]' : ''}`}
            aria-hidden
          />
        )}
        <span className="font-bold tracking-wide">{loading ? 'Detecting…' : label}</span>
        {!loading && !disabled && (
          <ArrowLeftRight
            size={compact ? 13 : 14}
            className="shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
            aria-hidden
          />
        )}
      </button>
      {!disabled && !loading && (
        <p className="text-[10px] font-medium text-center text-[var(--color-text-muted)]">
          Tap to switch · Office ↔ WFH
        </p>
      )}
    </div>
  );
};

export default WorkModeToggle;
