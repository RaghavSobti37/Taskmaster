import React, { useState, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

const CKDropdown = memo(({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Select Option", 
  label,
  className = "",
  multi = false,
  disabled = false,
  rightAction = null,
  searchable = true,
  renderOption = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleSelect = (option) => {
    if (multi) {
      const newValue = Array.isArray(value) ? [...value] : [];
      const index = newValue.findIndex(v => v === option.value);
      if (index > -1) {
        newValue.splice(index, 1);
      } else {
        newValue.push(option.value);
      }
      onChange(newValue);
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
  };

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabels = options
    .filter(opt => multi ? (value || []).includes(opt.value) : opt.value === value)
    .map(opt => opt.label);

  const displayText = selectedLabels.length > 0 
    ? (multi ? selectedLabels.join(', ') : selectedLabels[0]) 
    : placeholder;

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') setIsOpen(false);
    if (e.key === 'Tab') setIsOpen(false);
  };

  return (
    <div className={`relative flex flex-col gap-2 w-full min-w-0 ${className}`} ref={dropdownRef} onKeyDown={handleKeyDown}>
      {(label || rightAction) && (
        <div className="flex items-center justify-between gap-2 min-w-0">
          {label && (
            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              {label}
            </label>
          )}
          {rightAction && (
            <button
              type="button"
              onClick={rightAction.onClick}
              className="shrink-0 text-[9px] font-black text-[var(--color-action-primary)] hover:text-[var(--color-action-hover)] uppercase tracking-widest"
            >
              {rightAction.label}
            </button>
          )}
        </div>
      )}

      <div className="flex w-full min-w-0 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full min-w-0 min-h-[2.5rem] flex items-center justify-between px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] transition-all outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--color-action-primary)] focus:border-[var(--color-action-primary)]'}`}
        >
          <span className={`text-[13px] font-bold truncate ${selectedLabels.length === 0 ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
            {displayText}
          </span>
          <ChevronDown size={14} className={`text-[var(--color-text-muted)] transition-transform duration-300 ${isOpen ? 'rotate-180 text-[var(--color-action-primary)]' : ''}`} />
        </button>
        {rightAction?.icon && (
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-action-primary)] shadow-lg shadow-[var(--color-action-primary)]/20 flex items-center justify-center text-white shrink-0 active:scale-95 transition-transform">
             <rightAction.icon size={18} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full left-0 right-0 mt-2 z-[200] bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl shadow-xl overflow-hidden backdrop-blur-xl"
          >
            {searchable && (
              <div className="p-2 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/50">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Quick search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none focus:border-[var(--color-action-primary)]/50 transition-all"
                />
              </div>
            )}
            <div className="max-h-64 overflow-y-auto custom-scrollbar py-1">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">No matching results</p>
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = multi 
                    ? (value || []).includes(option.value) 
                    : value === option.value;
                  
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-all hover:bg-[var(--color-bg-workspace)] ${isSelected ? 'text-[var(--color-action-primary)] bg-[var(--color-action-primary)]/5' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                    >
                      {renderOption ? renderOption(option) : option.label}
                      {isSelected && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <Check size={14} className="text-[var(--color-action-primary)]" />
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
});

export default CKDropdown;
