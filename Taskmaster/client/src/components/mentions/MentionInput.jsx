import React from 'react';
import MentionRichText from './MentionRichText';
import MentionAutocompleteMenu from './MentionAutocompleteMenu';
import { useMentionAutocomplete } from '../../hooks/useMentionAutocomplete';

const MentionInput = ({
  value = '',
  onChange,
  disabled = false,
  className = '',
  placeholder = 'What needs to be done? Use @name or #Asset',
  editSessionKey,
  menuPlacement = 'below',
  /** Block layout so long titles wrap on narrow screens (default: inline chips) */
  wrapRichText = false,
}) => {
  const {
    inputRef,
    users,
    assets,
    assetsError,
    menu,
    menuItems,
    showMenu,
    showRichView,
    showDisabledRichView,
    enterEdit,
    handleRichViewMouseDown,
    handleFocus,
    syncMenuFromEl,
    insertAtCursor,
    handleChange,
    handleKeyDown,
    handleBlur,
  } = useMentionAutocomplete({ value, onChange, disabled, editSessionKey, multiline: false });

  const inputEvents = {
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onBlur: handleBlur,
    onFocus: handleFocus,
    onClick: (e) => syncMenuFromEl(e.target),
    onSelect: (e) => syncMenuFromEl(e.target),
  };

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
          className={`${className} min-h-[2.5rem] w-full min-w-0 cursor-text font-bold overflow-hidden`}
        >
          <MentionRichText
            text={value}
            users={users}
            assets={assets}
            className="text-sm font-bold w-full min-w-0"
            inline={!wrapRichText}
          />
        </div>
      ) : showDisabledRichView ? (
        <div className={`${className} min-h-[2.5rem] w-full min-w-0 opacity-60 font-bold overflow-hidden`}>
          <MentionRichText
            text={value}
            users={users}
            assets={assets}
            className="text-sm font-bold w-full min-w-0"
            inline={!wrapRichText}
          />
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          className={className}
          {...inputEvents}
        />
      )}

      {showMenu && (
        <MentionAutocompleteMenu
          menu={menu}
          menuItems={menuItems}
          users={users}
          assets={assets}
          assetsError={assetsError}
          menuPlacement={menuPlacement}
          onPick={insertAtCursor}
        />
      )}
    </div>
  );
};

export default MentionInput;
