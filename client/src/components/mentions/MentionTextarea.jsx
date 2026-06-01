import React from 'react';
import MentionRichText from './MentionRichText';
import { useMentionAutocomplete } from '../../hooks/useMentionAutocomplete';

const MentionTextarea = ({
  value = '',
  onChange,
  disabled = false,
  className = '',
  placeholder = 'Add details... Use @name to mention someone, #AssetName to link an asset.',
  rows = 4,
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
  } = useMentionAutocomplete({ value, onChange, disabled, editSessionKey, multiline: true });

  const minHeight = rows >= 4 ? 'min-h-[88px]' : 'min-h-[2.5rem]';

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
          className={`${className} ${minHeight} cursor-text`}
        >
          <MentionRichText text={value} users={users} assets={assets} className="text-sm" />
        </div>
      ) : showDisabledRichView ? (
        <div className={`${className} ${minHeight} opacity-60`}>
          <MentionRichText text={value} users={users} assets={assets} className="text-sm" />
        </div>
      ) : (
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={disabled}
          rows={rows}
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

export default MentionTextarea;
