import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

const CKDropdown = ({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Select Option", 
  label,
  className = "",
  multi = false,
  disabled = false,
  rightAction = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const selectedLabels = options
    .filter(opt => multi ? (value || []).includes(opt.value) : opt.value === value)
    .map(opt => opt.label);

  const displayText = selectedLabels.length > 0 
    ? (multi ? selectedLabels.join(', ') : selectedLabels[0]) 
    : placeholder;

  return (
    <div className={`space-y-2 relative ${className}`} ref={dropdownRef}>
      <div className="flex items-center justify-between px-1">
        {label && <label className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">{label}</label>}
        {rightAction && <button type="button" onClick={rightAction.onClick} className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest">{rightAction.label}</button>}
      </div>
      
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`flex-1 flex items-center justify-between px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl transition-all outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--color-action-primary)] focus:ring-2 focus:ring-[var(--color-action-primary)]/20'}`}
        >
          <span className={`text-sm font-bold truncate ${selectedLabels.length === 0 ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
            {displayText}
          </span>
          <ChevronDown size={16} className={`text-[var(--color-text-muted)] transition-transform duration-300 ${isOpen ? 'rotate-180 text-[var(--color-action-primary)]' : ''}`} />
        </button>
        {rightAction?.icon && (
          <div className="w-12 h-12 rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/30 flex items-center justify-center text-white shrink-0">
             <rightAction.icon size={20} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full left-0 right-0 mt-2 z-[200] bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl shadow-2xl overflow-hidden py-2"
          >
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              {options.length === 0 ? (
                <div className="px-4 py-3 text-xs text-[var(--color-text-muted)] italic text-center">No active nodes available</div>
              ) : (
                options.map((option) => {
                  const isSelected = multi 
                    ? (value || []).includes(option.value) 
                    : value === option.value;
                  
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-xs font-bold transition-all hover:bg-[var(--color-bg-workspace)] ${isSelected ? 'text-blue-500 bg-blue-500/5' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                    >
                      {option.label}
                      {isSelected && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <Check size={14} className="text-blue-500" />
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

export default CKDropdown;
