import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  TASK_CATEGORY_OPTIONS,
  slugTaskCategoryLabel,
  slugifyTaskCategoryInput,
} from '../../constants/taskOptions';

const categoryButtonClass = (isSelected, disabled) => `
  min-h-[2.25rem] px-2 py-2 rounded-[var(--radius-atomic)] border text-xs font-semibold transition-all
  ${isSelected
    ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]'
    : 'border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:border-[var(--color-action-primary)]/40'}
  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
`;

/**
 * TaskCategorySelect — always-visible category grid with optional custom "Add".
 */
const TaskCategorySelect = ({
  value,
  onChange,
  label = 'Category',
  disabled = false,
  options = TASK_CATEGORY_OPTIONS,
  className = '',
  allowAdd = true,
  onAddCategory = null,
}) => {
  const [customOptions, setCustomOptions] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [savingAdd, setSavingAdd] = useState(false);

  useEffect(() => {
    if (!value) return;
    const inBase = options.some((o) => o.value === value);
    if (inBase) return;
    setCustomOptions((prev) => {
      if (prev.some((o) => o.value === value)) return prev;
      return [...prev, { value, label: slugTaskCategoryLabel(value) }];
    });
  }, [value, options]);

  const allOptions = useMemo(() => {
    const seen = new Set(options.map((o) => o.value));
    const merged = [...options];
    for (const entry of customOptions) {
      if (!seen.has(entry.value)) {
        merged.push(entry);
        seen.add(entry.value);
      }
    }
    return merged;
  }, [options, customOptions]);

  const commitAdd = async () => {
    const slug = slugifyTaskCategoryInput(draft);
    if (!slug || savingAdd) return;
    const entry = { value: slug, label: draft.trim() || slugTaskCategoryLabel(slug) };
    setSavingAdd(true);
    try {
      if (onAddCategory) {
        await onAddCategory(draft.trim() || slug);
      } else if (!allOptions.some((o) => o.value === slug)) {
        setCustomOptions((prev) => [...prev, entry]);
      }
      onChange(slug);
      setDraft('');
      setAdding(false);
    } finally {
      setSavingAdd(false);
    }
  };

  const cancelAdd = () => {
    setDraft('');
    setAdding(false);
  };

  return (
    <div className={`flex flex-col gap-2 w-full min-w-0 ${className}`}>
      {label && (
        <span className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
          {label}
        </span>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
        {allOptions.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled || savingAdd}
              onClick={() => onChange(opt.value)}
              className={categoryButtonClass(isSelected, disabled)}
            >
              {opt.label}
            </button>
          );
        })}

        {allowAdd && !disabled && (
          adding ? (
            <input
              type="text"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitAdd();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelAdd();
                }
              }}
              onBlur={() => {
                if (draft.trim()) commitAdd();
                else cancelAdd();
              }}
              placeholder="New category"
              className="min-h-[2.25rem] px-2 py-2 rounded-[var(--radius-atomic)] border border-[var(--color-action-primary)]/50 bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-action-primary)]/30"
              aria-label="New category name"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={`${categoryButtonClass(false, false)} border-dashed inline-flex items-center justify-center gap-1`}
            >
              <Plus size={14} aria-hidden />
              Add
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default TaskCategorySelect;
