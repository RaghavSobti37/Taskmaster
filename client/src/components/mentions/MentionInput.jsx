import React from 'react';
import MentionRichText from './MentionRichText';
import { useMentionAutocomplete } from '../../hooks/useMentionAutocomplete';

const MentionInput = ({
  value = '',
  onChange,
  disabled = false,
  className = '',
  placeholder = 'What needs to be done? Use @name or #Asset',
  editSessionKey,
}) => {
  const {
    inputRef,
    users,
    assets,
    menu,
    menuItems,
    isEditing,
    showRichView,
    showDisabledRichView,
    enterEdit,
    handleRichViewMouseDown,
    insertAtCursor,
    handleChange,
    handleKeyDown,
    handleBlur,
  } = useMentionAutocomplete({ value, onChange, disabled, editSessionKey, multiline: false });

  return (
    <div className="relative w-full min-w-0">
      {showRichView ? (
        <div
          role="button"
          tabIndex={0}
          onMouseDown={handleRichViewMouseDown}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') enterEdit();
          }}
          className={`${className} min-h-[2.5rem] cursor-text font-bold`}
        >
          <MentionRichText text={value} users={users} assets={assets} className="text-sm font-bold" inline />
        </div>
      ) : showDisabledRichView ? (
        <div className={`${className} min-h-[2.5rem] opacity-60 font-bold`}>
          <MentionRichText text={value} users={users} assets={assets} className="text-sm font-bold" inline />
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={className}
        />
      )}

      {isEditing && menu && menuItems.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-44 overflow-y-auto rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] shadow-lg">
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-bg-secondary)] transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                insertAtCursor(item.insert);
              }}
            >
              {menu.type === 'user' ? '@' : '#'}{item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionInput;
