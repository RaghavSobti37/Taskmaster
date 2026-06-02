import React, { useEffect, useRef } from 'react';

const QUICK_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥',
  '✅', '🎉', '💯', '⭐', '😊', '🤔', '👀', '💪',
  '📎', '📷', '🚀', '✨', '☕', '🎵', '📅', '💬',
];

const ChatEmojiPicker = ({ open, onClose, onPick, anchorRef }) => {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (
        panelRef.current?.contains(e.target) ||
        anchorRef?.current?.contains(e.target)
      ) {
        return;
      }
      onClose?.();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full left-0 mb-2 z-50 w-[min(100vw-2rem,280px)] rounded-[var(--radius-lg)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] shadow-lg p-2"
      role="listbox"
      aria-label="Emoji picker"
    >
      <div className="grid grid-cols-8 gap-0.5">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            role="option"
            className="h-9 w-9 flex items-center justify-center rounded-[var(--radius-lg)] text-lg hover:bg-[var(--color-bg-secondary)] active:scale-95 transition-transform"
            onClick={() => {
              onPick(emoji);
              onClose?.();
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChatEmojiPicker;
