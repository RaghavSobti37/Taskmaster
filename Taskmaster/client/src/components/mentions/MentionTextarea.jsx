import React from 'react';
import MentionRichText from './MentionRichText';
import MentionAutocompleteMenu from './MentionAutocompleteMenu';
import { useMentionAutocomplete } from '../../hooks/useMentionAutocomplete';

const MentionTextarea = ({
  value = '',
  onChange,
  disabled = false,
  className = '',
  placeholder = 'Add details... Use @name to mention someone, #AssetName to link an asset.',
  rows = 4,
  editSessionKey,
  forcePlain = false,
  menuPlacement = 'below',
  mentionUsers = null,
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
  } = useMentionAutocomplete({
    value,
    onChange,
    disabled,
    editSessionKey,
    multiline: true,
    forcePlain,
    mentionUsers,
  });

  const minHeight = rows >= 4 ? 'min-h-[88px]' : 'min-h-[2.5rem]';
  const useRich = !forcePlain && showRichView;
  const useDisabledRich = !forcePlain && showDisabledRichView;

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
      {useRich ? (
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
      ) : useDisabledRich ? (
        <div className={`${className} ${minHeight} opacity-60`}>
          <MentionRichText text={value} users={users} assets={assets} className="text-sm" />
        </div>
      ) : (
        <textarea
          ref={inputRef}
          value={value}
          disabled={disabled}
          rows={rows}
          placeholder={placeholder}
          className={`${className} resize-none overflow-hidden`.trim()}
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

export default MentionTextarea;
