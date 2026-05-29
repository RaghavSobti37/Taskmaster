import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';

const MENU_LIST_MAX = 280;
const SEARCH_BLOCK_HEIGHT = 44;
/** Above ModalShell (100–1000) and toasts */
const MENU_Z_INDEX = 99999;

const normalizeValue = (val) => (val == null || val === '' ? '' : String(val));

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
  multi = false,
  renderOption = null,
  usePortal = true,
  menuMinWidth = 280,
}) => {
  const multiSelect = isMulti || multi;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [menuStyle, setMenuStyle] = useState(null);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  const computeMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return null;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < MENU_LIST_MAX + SEARCH_BLOCK_HEIGHT && spaceAbove > spaceBelow;
    const availableSpace = Math.max(120, (openUp ? spaceAbove : spaceBelow) - 4);
    const searchHeight = searchable ? SEARCH_BLOCK_HEIGHT : 0;
    const listMaxHeight = Math.max(80, Math.min(MENU_LIST_MAX, availableSpace - searchHeight));
    const menuWidth = Math.max(rect.width, menuMinWidth);

    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }
    left = Math.max(8, left);

    return {
      position: 'fixed',
      left,
      width: menuWidth,
      boxSizing: 'border-box',
      zIndex: MENU_Z_INDEX,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      maxHeight: availableSpace,
      listMaxHeight,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    };
  }, [menuMinWidth, searchable]);

  const updateMenuPosition = useCallback(() => {
    const style = computeMenuPosition();
    if (style) setMenuStyle(style);
  }, [computeMenuPosition]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setIsOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || !usePortal) return undefined;
    updateMenuPosition();
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [isOpen, usePortal, updateMenuPosition, search, options.length]);

  useEffect(() => {
    if (isOpen && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleToggle = () => {
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
      setSearch('');
      return;
    }
    if (usePortal) {
      const style = computeMenuPosition();
      if (!style) return;
      flushSync(() => {
        setMenuStyle(style);
        setIsOpen(true);
      });
      return;
    }
    setIsOpen(true);
  };

  const handleSelect = (option) => {
    if (multiSelect) {
      const currentValues = Array.isArray(value) ? value.map(normalizeValue) : [];
      const optionValue = normalizeValue(option.value);
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter((v) => v !== optionValue)
        : [...currentValues, optionValue];
      onChange(newValues);
    } else {
      onChange(option.value);
      setIsOpen(false);
      setSearch('');
    }
  };

  const isSelected = (val) => {
    if (multiSelect) {
      const normalized = normalizeValue(val);
      return Array.isArray(value) && value.map(normalizeValue).includes(normalized);
    }
    return normalizeValue(value) === normalizeValue(val);
  };

  let displayText = placeholder;
  let hasSelection = false;
  if (multiSelect) {
    const selectedLabels = options
      .filter((opt) => Array.isArray(value) && value.includes(opt.value))
      .map((opt) => opt.label);
    if (selectedLabels.length > 0) {
      displayText = selectedLabels.join(', ');
      hasSelection = true;
    }
  } else {
    const selectedLabel = options.find((opt) => normalizeValue(opt.value) === normalizeValue(value))?.label;
    if (selectedLabel) {
      displayText = selectedLabel;
      hasSelection = true;
    }
  }

  const filteredOptions = searchable && search
    ? options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const isCompact = variant === 'compact';

  const portalMenuClass =
    'bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] shadow-2xl';
  const inlineMenuClass =
    'absolute top-full left-0 right-0 mt-1 z-[300] bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] shadow-xl min-w-full flex flex-col overflow-hidden';

  const listMaxHeight = menuStyle?.listMaxHeight ?? MENU_LIST_MAX;
  let panelStyle = { position: 'fixed', visibility: 'hidden' };
  if (menuStyle) {
    const { listMaxHeight: _listMaxHeight, ...rest } = menuStyle;
    panelStyle = rest;
  }

  const menuPanel = (
    <div
      ref={menuRef}
      style={usePortal ? panelStyle : undefined}
      className={usePortal ? portalMenuClass : inlineMenuClass}
    >
      {searchable && (
        <div className="shrink-0 px-2 py-1.5 border-b border-[var(--color-bg-border)]">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-7 pr-2 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-[11px] outline-none"
            />
          </div>
        </div>
      )}

      <div
        className={`flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar ${
          isCompact ? 'text-[11px]' : 'text-sm'
        }`}
        style={{ maxHeight: usePortal ? listMaxHeight : `min(${MENU_LIST_MAX}px, 50vh)` }}
      >
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-2 text-[10px] text-[var(--color-text-muted)] italic text-center">
            No matches
          </div>
        ) : (
          filteredOptions.map((option) => {
            const selected = isSelected(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option)}
                className={`
                  w-full flex items-center justify-between gap-2 px-3 py-1.5 transition-colors text-left
                  hover:bg-[var(--color-bg-secondary)]
                  ${selected
                    ? 'text-[var(--color-action-primary)] font-semibold bg-[var(--color-bg-secondary)]/60'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }
                `}
              >
                <span className="min-w-0 flex-1 truncate leading-snug">
                  {renderOption ? renderOption(option) : option.label}
                </span>
                {selected && <Check size={14} className="text-[var(--color-action-primary)] shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const renderedMenu = isOpen
    ? usePortal && typeof document !== 'undefined'
      ? createPortal(menuPanel, document.body)
      : menuPanel
    : null;

  return (
    <div className={`relative flex flex-col gap-2 w-full min-w-0 ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block tm-section-label">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        title={hasSelection ? displayText : undefined}
        className={`
          w-full min-h-[2.5rem] flex items-center justify-between gap-2 transition-all outline-none
          bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]
          rounded-[var(--radius-atomic)]
          ${isCompact ? 'px-2 py-1 text-[11px] min-h-[2rem]' : 'px-3 py-2 text-sm'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--color-action-primary)] cursor-pointer'}
          ${isOpen ? 'border-[var(--color-action-primary)]' : ''}
        `}
      >
        <span
          className={`min-w-0 flex-1 text-left leading-snug line-clamp-2 ${
            !hasSelection ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'
          }`}
        >
          {displayText}
        </span>
        <ChevronDown
          size={isCompact ? 12 : 14}
          className={`text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[var(--color-action-primary)]' : ''
          }`}
        />
      </button>

      {renderedMenu}
    </div>
  );
};

export default NexusDropdown;
