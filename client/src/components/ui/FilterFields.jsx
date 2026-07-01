import React, { useMemo, useState } from 'react';
import { Search, Star, Calendar, X } from 'lucide-react';

const FIELD_LABEL_CLASS =
  'block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]';

const OPTION_BASE =
  'w-full min-h-[44px] px-3 py-2.5 rounded-[var(--radius-atomic)] border text-left text-xs font-bold transition-colors';

function optionClass(selected) {
  return `${OPTION_BASE} ${
    selected
      ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]'
      : 'border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] hover:border-[var(--color-action-primary)]/40'
  }`;
}

function chipClass(selected) {
  return `min-h-[44px] px-3 py-2 rounded-full border text-[10px] font-bold uppercase tracking-wide transition-colors ${
    selected
      ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/15 text-[var(--color-action-primary)]'
      : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
  }`;
}

function SearchableRadioList({ options = [], value, onChange, placeholder = 'Search options…' }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o.label || '').toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="space-y-2">
      {options.length > 8 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full min-h-[44px] pl-9 pr-3 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] text-xs font-medium text-[var(--color-text-primary)] outline-none focus:border-[var(--color-action-primary)]"
          />
        </div>
      )}
      <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
        {filtered.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={optionClass(value === opt.value)}
            aria-pressed={value === opt.value}
          >
            {opt.label}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-[10px] text-[var(--color-text-muted)] italic px-1">No matches</p>
        )}
      </div>
    </div>
  );
}

function RadioList({ options = [], value, onChange }) {
  return (
    <div className="space-y-1.5" role="radiogroup">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={optionClass(value === opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ChipMultiSelect({ options = [], value = [], onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (v) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => toggle(opt.value)}
          className={chipClass(selected.includes(opt.value))}
          aria-pressed={selected.includes(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SegmentedControl({ options = [], value, onChange }) {
  return (
    <div className="inline-flex w-full items-stretch rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 min-h-[44px] px-2 rounded-[var(--radius-atomic)] text-[10px] font-bold uppercase tracking-wide transition-colors ${
            value === opt.value
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-action-primary)] border border-[var(--color-bg-border)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DateRangeField({ value = {}, onChange }) {
  const start = value.start ?? '';
  const end = value.end ?? '';
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      <div className="flex items-center gap-2 flex-1 min-w-0 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] px-2 min-h-[44px]">
        <Calendar size={14} className="text-[var(--color-text-muted)] shrink-0" />
        <input
          type="date"
          value={start}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
          aria-label="From date"
          className="flex-1 min-w-0 bg-transparent text-xs font-medium text-[var(--color-text-primary)] outline-none"
        />
      </div>
      <span className="text-[10px] text-[var(--color-text-muted)] text-center shrink-0">–</span>
      <div className="flex items-center gap-2 flex-1 min-w-0 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] px-2 min-h-[44px]">
        <input
          type="date"
          value={end}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
          aria-label="To date"
          className="flex-1 min-w-0 bg-transparent text-xs font-medium text-[var(--color-text-primary)] outline-none"
        />
        {(start || end) && (
          <button
            type="button"
            onClick={() => onChange({ start: '', end: '' })}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
            aria-label="Clear dates"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function ToggleField({ value, onChange, label }) {
  const on = Boolean(value);
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-3 rounded-[var(--radius-atomic)] border text-[10px] font-bold uppercase tracking-wide transition-colors ${
        on
          ? 'border-amber-400 bg-amber-400/10 text-amber-500'
          : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
      }`}
      aria-pressed={on}
    >
      <Star size={14} className={on ? 'fill-amber-400' : ''} />
      {label || (on ? 'On' : 'Off')}
    </button>
  );
}

/**
 * Renders one filter field inside SelectionFilterPanel.
 * @param {{ field: import('./selectionFilterUtils').FilterFieldConfig }} props
 */
export function FilterField({ field }) {
  if (!field || field.hidden) return null;

  const { id, label, type = 'radio', options = [], value, onChange, searchable, placeholder } = field;

  let control;
  switch (type) {
    case 'chips':
      control = <ChipMultiSelect options={options} value={value} onChange={onChange} />;
      break;
    case 'searchable':
    case 'radio':
      control = searchable || options.length > 8 ? (
        <SearchableRadioList
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder || `Search ${label?.toLowerCase() || 'options'}…`}
        />
      ) : (
        <RadioList options={options} value={value} onChange={onChange} />
      );
      break;
    case 'segmented':
      control = <SegmentedControl options={options} value={value} onChange={onChange} />;
      break;
    case 'dateRange':
      control = <DateRangeField value={value} onChange={onChange} />;
      break;
    case 'toggle':
      control = <ToggleField value={value} onChange={onChange} label={field.toggleLabel} />;
      break;
    case 'custom':
      control = typeof field.render === 'function' ? field.render() : null;
      break;
    default:
      control = <RadioList options={options} value={value} onChange={onChange} />;
  }

  return (
    <div className="w-full min-w-0 space-y-1.5" data-filter-field={id}>
      {label && type !== 'toggle' && <span className={FIELD_LABEL_CLASS}>{label}</span>}
      {type === 'toggle' && <span className={FIELD_LABEL_CLASS}>{label}</span>}
      <div className="w-full min-w-0">{control}</div>
    </div>
  );
}

/** Stack of labeled filter fields for SelectionFilterPanel / MobileFilterSheet. */
export default function FilterFields({ fields = [] }) {
  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <FilterField key={field.id} field={field} />
      ))}
    </div>
  );
}
