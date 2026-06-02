import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from './primitives';

/**
 * SearchInput — standardized search field used across list/table pages.
 */
const SearchInput = ({
  value,
  onChange,
  placeholder = 'Search...',
  label,
  className = '',
  onClear,
  ...props
}) => {
  const handleClear = () => {
    onChange?.({ target: { value: '' } });
    onClear?.();
  };

  return (
    <div className={`w-full min-w-0 overflow-hidden ${className}`}>
      <Input
        {...(label ? { label } : {})}
        icon={Search}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
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
