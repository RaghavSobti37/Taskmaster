import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search } from 'lucide-react';

const NexusDropdown = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  label,
  className = '',
  disabled = false,
  searchable = false,
  variant = 'default',
  required = false,
  isMulti = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleSelect = (option) => {
    if (isMulti) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(option.value)
        ? currentValues.filter(v => v !== option.value)
        : [...currentValues, option.value];
      onChange(newValues);
    } else {
      onChange(option.value);
      setIsOpen(false);
      setSearch('');
    }
  };

  const isSelected = (val) => {
    if (isMulti) {
      return Array.isArray(value) && value.includes(val);
    }
    return value === val;
  };

  let displayText = placeholder;
  let hasSelection = false;
  if (isMulti) {
    const selectedLabels = options
      .filter(opt => Array.isArray(value) && value.includes(opt.value))
      .map(opt => opt.label);
    if (selectedLabels.length > 0) {
      displayText = selectedLabels.join(', ');
      hasSelection = true;
    }
  } else {
    const selectedLabel = options.find(opt => opt.value === value)?.label;
    if (selectedLabel) {
      displayText = selectedLabel;
      hasSelection = true;
    }
  }

  const filteredOptions = searchable && search
    ? options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const isCompact = variant === 'compact';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider ml-0.5 mb-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between transition-all outline-none
          bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]
          rounded-[var(--radius-atomic)]
          ${isCompact
            ? 'px-2 py-1 text-[11px]'
            : 'px-3 py-1.5 text-sm'
          }
          ${disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-[var(--color-action-primary)] cursor-pointer'
          }
          ${isOpen ? 'border-[var(--color-action-primary)]' : ''}
        `}
      >
        <span className={`truncate ${!hasSelection ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
          {displayText}
        </span>
        <ChevronDown
          size={isCompact ? 12 : 14}
          className={`ml-2 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-[var(--color-action-primary)]' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full left-0 min-w-full max-w-md mt-1 z-[300] bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] shadow-xl overflow-hidden"
          >
            {searchable && (
              <div className="p-1 border-b border-[var(--color-bg-border)]">
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-7 pr-2 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-[11px] outline-none"
                  />
                </div>
              </div>
            )}

            <div className={`overflow-y-auto max-h-60 py-1 ${isCompact ? 'text-[11px]' : 'text-sm'}`}>
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-[10px] text-[var(--color-text-muted)] italic text-center">
                  No matches
                </div>
              ) : (
                filteredOptions.map(option => {
                  const selected = isSelected(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={`
                        w-full flex items-center justify-between px-3 py-1.5 transition-all
                        hover:bg-[var(--color-bg-secondary)]
                        ${selected
                          ? 'text-[var(--color-action-primary)] font-bold'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                        }
                      `}
                    >
                      <span className="truncate">{option.label}</span>
                      {selected && <Check size={12} className="text-[var(--color-action-primary)] shrink-0 ml-2" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NexusDropdown;
