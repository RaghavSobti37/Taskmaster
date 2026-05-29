import React from 'react';
import { PROJECT_ROLE_OPTIONS } from '../../constants/taskOptions';

/**
 * RoleOptionBoxes — 3-tile project role picker (Admin / Manager / User).
 */
const RoleOptionBoxes = ({
  value,
  onChange,
  options = PROJECT_ROLE_OPTIONS,
  label = 'Project role',
  disabled = false,
  className = '',
}) => (
  <div className={`flex flex-col gap-2 w-full min-w-0 ${className}`}>
    {label && (
      <span className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
        {label}
      </span>
    )}
    <div className="grid grid-cols-3 gap-2 w-full">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`
              min-h-[2.5rem] px-2 py-2 rounded-[var(--radius-atomic)] border text-center text-xs font-bold uppercase tracking-wide transition-all
              ${selected
                ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)] shadow-sm'
                : 'border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:border-[var(--color-action-primary)]/50 hover:text-[var(--color-text-primary)]'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  </div>
);

export default RoleOptionBoxes;
