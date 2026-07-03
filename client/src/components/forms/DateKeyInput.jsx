import React, { useMemo } from 'react';
import { formatDateKeyForDisplay } from '../../utils/dateDisplay';
import { resolveDateInputMin } from '../../utils/dateValidation';

/**
 * Date picker that always shows DD/MM/YYYY (native type="date" overlay).
 */
export default function DateKeyInput({
  value = '',
  onChange,
  min,
  max,
  disabled = false,
  className = '',
  displayClassName = '',
  emptyLabel = 'Select date',
  withWeekday = false,
  'aria-label': ariaLabel,
}) {
  const display = value
    ? formatDateKeyForDisplay(value, { withWeekday })
    : emptyLabel;

  const effectiveMin = useMemo(
    () => resolveDateInputMin(value, min),
    [value, min]
  );

  return (
    <div className={`relative w-full min-w-0 ${className}`.trim()}>
      <div
        className={`${displayClassName} ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`.trim()}
        aria-hidden
      >
        {display}
      </div>
      <input
        type="date"
        value={value || ''}
        min={effectiveMin}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        onClick={(e) => e.target.showPicker?.()}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
        aria-label={ariaLabel || (value ? display : 'Date')}
      />
    </div>
  );
}
