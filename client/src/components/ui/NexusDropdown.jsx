import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search } from 'lucide-react';

/**
 * NexusDropdown — Universal scrollable dropdown.
 * Replaces all native <select> elements for consistent design language.
 *
 * @param {Array} options       - [{ value, label }]
 * @param {string|number} value - Current selected value
 * @param {function} onChange   - Callback with selected value
 * @param {string} placeholder  - Placeholder text
 * @param {string} label        - Optional label text
 * @param {string} className    - Additional wrapper classes
 * @param {boolean} disabled    - Disable interaction
 * @param {boolean} searchable  - Show search input for long lists
 * @param {string} variant      - 'default' | 'compact' (for tables)
 * @param {boolean} required    - Visual required indicator
 */
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
    onChange(option.value);
    setIsOpen(false);
    setSearch('');
  };

  const selectedLabel = options.find(opt => opt.value === value)?.label;
  const displayText = selectedLabel || placeholder;

  const filteredOptions = searchable && search
    ? options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const isCompact = variant === 'compact';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1 mb-1.5">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between transition-all outline-none
          ${isCompact
            ? 'px-3 py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]'
            : 'px-4 py-3 text-xs font-bold rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] shadow-inner'
          }
          ${disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-[var(--color-action-primary)] focus:ring-2 focus:ring-[var(--color-action-primary)]/20 cursor-pointer'
          }
          ${isOpen ? 'border-[var(--color-action-primary)] ring-2 ring-[var(--color-action-primary)]/20' : ''}
        `}
      >
        <span className={`truncate ${!selectedLabel ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
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
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`
              absolute top-full left-0 right-0 mt-1.5 z-[300]
              bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]
              rounded-xl shadow-2xl overflow-hidden
            `}
          >
            {/* Search */}
            {searchable && (
              <div className="p-2 border-b border-[var(--color-bg-border)]">
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-8 pr-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-[10px] font-bold outline-none"
                  />
                </div>
              </div>
            )}

            {/* Options */}
            <div className={`overflow-y-auto custom-scrollbar ${isCompact ? 'max-h-48 py-1' : 'max-h-60 py-1.5'}`}>
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] italic text-center">
                  No options found
                </div>
              ) : (
                filteredOptions.map(option => {
                  const isSelected = value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={`
                        w-full flex items-center justify-between transition-all
                        ${isCompact
                          ? 'px-3 py-2 text-[10px] font-black'
                          : 'px-4 py-2.5 text-xs font-bold'
                        }
                        hover:bg-[var(--color-bg-workspace)]
                        ${isSelected
                          ? 'text-[var(--color-action-primary)] bg-[var(--color-action-primary)]/5'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                        }
                      `}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <Check size={12} className="text-[var(--color-action-primary)] shrink-0 ml-2" />
                        </motion.div>
                      )}
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
