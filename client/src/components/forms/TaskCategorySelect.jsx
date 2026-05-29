import React from 'react';
import { TASK_CATEGORY_OPTIONS } from '../../constants/taskOptions';

/**
 * TaskCategorySelect — general task nature categories (replaces granular department types).
 */
const TaskCategorySelect = ({
  value,
  onChange,
  label = 'Category',
  disabled = false,
  options = TASK_CATEGORY_OPTIONS,
  className = '',
}) => (
  <div className={`flex flex-col gap-2 w-full min-w-0 ${className}`}>
    {label && (
      <span className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
        {label}
      </span>
    )}
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`
              min-h-[2.25rem] px-2 py-2 rounded-[var(--radius-atomic)] border text-xs font-semibold transition-all
              ${selected
                ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]'
                : 'border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:border-[var(--color-action-primary)]/40'}
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

export default TaskCategorySelect;
