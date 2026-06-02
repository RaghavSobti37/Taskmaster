import React from 'react';

const ChatAvatar = ({ src, initials = '?', isGroup = false, size = 49, online = false }) => {
  const fontSize = size >= 44 ? 18 : 12;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt=""
          className="rounded-full object-cover border border-[var(--color-bg-border)]"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          className={`rounded-full flex items-center justify-center font-semibold border border-[var(--color-bg-border)] ${
            isGroup
              ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
              : 'bg-[var(--color-pastel-mint-bg)] text-[var(--color-pastel-mint-text)]'
          }`}
          style={{ width: size, height: size, fontSize }}
        >
          {initials}
        </span>
      )}
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-[var(--color-bg-surface)] bg-[var(--color-action-primary)]"
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
};

export default ChatAvatar;
