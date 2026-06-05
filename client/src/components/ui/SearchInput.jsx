import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from './primitives';

/**
 * SearchInput — standardized search field used across list/table pages.
 * variant="toolbar" — compact h-9 inline control for PageToolbar rows.
 */
const SearchInput = ({
  value,
  onChange,
  placeholder = 'Search...',
  label,
  className = '',
  onClear,
  variant = 'field',
  ...props
}) => {
  const handleClear = () => {
    onChange?.({ target: { value: '' } });
    onClear?.();
  };

  if (variant === 'toolbar') {
    const toolbarLabel = label ?? 'Search';
    return (
      <div
        className={`tm-toolbar-field tm-toolbar-search flex flex-col gap-1.5 min-w-[10rem] w-[12rem] max-w-[16rem] shrink-0 ${className}`}
        data-toolbar-field=""
      >
        {toolbarLabel ? (
          <span className="block tm-section-label leading-none">{toolbarLabel}</span>
        ) : null}
        <div className="relative min-w-0">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none z-[1]"
          />
          <input
            type="search"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className="mobile-form-control tm-toolbar-control block w-full pl-9 pr-8 text-xs bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] outline-none transition-colors focus:border-[var(--color-action-primary)]"
            {...props}
          />
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-[var(--radius-atomic)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full min-w-0 overflow-hidden ${className}`}>
      <Input
        {...(label ? { label } : {})}
        icon={Search}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        variant={variant === 'ghost' ? 'ghost' : 'field'}
        endAdornment={
          value ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : null
        }
        {...props}
      />
    </div>
  );
};

SearchInput.displayName = 'SearchInput';

export default SearchInput;
