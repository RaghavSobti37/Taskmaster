import React, { useEffect, useState } from 'react';
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
  collapseWhenSelected = false,
}) => {
  const selected = options.find((opt) => opt.value === value) || options.find((o) => o.value === 'general');
  const [showPicker, setShowPicker] = useState(!collapseWhenSelected || !value);

  useEffect(() => {
    if (collapseWhenSelected && value) {
      setShowPicker(false);
    }
  }, [collapseWhenSelected, value]);

  const handleSelect = (next) => {
    onChange(next);
    if (collapseWhenSelected) setShowPicker(false);
  };

  return (
    <div className={`flex flex-col gap-2 w-full min-w-0 ${className}`}>
      {label && (
        <span className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
          {label}
        </span>
      )}

      {collapseWhenSelected && value && !showPicker ? (
        <div className="flex items-center gap-2 min-h-[2.5rem]">
          <span
            className="flex-1 min-w-0 px-3 py-2 rounded-[var(--radius-atomic)] border border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10 text-xs font-semibold text-[var(--color-action-primary)]"
          >
            {selected?.label || value}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[var(--color-action-primary)] hover:underline"
            >
              Change
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
          {options.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(opt.value)}
                className={`
                  min-h-[2.25rem] px-2 py-2 rounded-[var(--radius-atomic)] border text-xs font-semibold transition-all
                  ${isSelected
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
      )}
    </div>
  );
};

export default TaskCategorySelect;
