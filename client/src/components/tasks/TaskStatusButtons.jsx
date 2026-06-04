import React from 'react';
import {
  TASK_STATUS_BUTTON_OPTIONS,
  taskStatusButtonClass,
  progressForTaskStatus,
} from '../../utils/taskStatusButtons';

const fieldLabelClass = 'block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2';

export default function TaskStatusButtons({ value, onChange, disabled = false }) {
  return (
    <div className="w-full min-w-0">
      <label className={fieldLabelClass}>Status</label>
      <div className="flex flex-wrap items-center gap-1.5">
        {TASK_STATUS_BUTTON_OPTIONS.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              title={option.label}
              disabled={disabled}
              onClick={() => onChange(option.value, progressForTaskStatus(option.value))}
              className={`rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all shrink-0 disabled:opacity-50 px-3 py-1 min-w-[5.5rem] ${taskStatusButtonClass(option.value, isActive)}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
