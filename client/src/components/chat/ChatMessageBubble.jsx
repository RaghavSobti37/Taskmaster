import React, { useState } from 'react';
import { FileText, Download, ImageIcon, Check, CheckCheck } from 'lucide-react';
import MentionRichText from '../mentions/MentionRichText';
import { isImageAttachment, formatMessageTime } from '../../utils/chatDisplay';

const ChatMessageBubble = ({ message, users = [], assets = [], isOwn, showRead = false, highlightQuery = '' }) => {
  const sender = message.senderId;
  const name = sender?.name || 'User';
  const avatar = sender?.avatar;
  const time = formatMessageTime(message.createdAt);

  const attachments = message.attachments || [];
  const images = attachments.filter(isImageAttachment);
  const files = attachments.filter((a) => !isImageAttachment(a));
  const hasText = Boolean(String(message.content || '').trim());
  const isSearchHit =
    highlightQuery &&
    String(message.content || '').toLowerCase().includes(highlightQuery.toLowerCase());

  const bubbleBase = isOwn
    ? 'bg-[var(--color-action-primary)]/14 border-[var(--color-action-primary)]/25 text-[var(--color-text-primary)] rounded-[var(--radius-lg)] rounded-br-sm'
    : 'bg-[var(--color-bg-surface)] border-[var(--color-bg-border)] text-[var(--color-text-primary)] rounded-[var(--radius-lg)] rounded-bl-sm shadow-sm';

  return (
    <div className={`flex w-full mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex gap-2 max-w-[min(100%,92%)] sm:max-w-[min(100%,75%)] min-w-0 ${
          isOwn ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {!isOwn && (
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 self-end bg-[var(--color-bg-secondary)] flex items-center justify-center text-[10px] font-bold border border-[var(--color-bg-border)] text-[var(--color-text-secondary)]">
            {avatar ? (
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>
        )}

        <div className={`flex flex-col gap-0.5 min-w-0 ${isOwn ? 'items-end' : 'items-start'}`}>
          {!isOwn && (
            <span className="text-[11px] font-medium text-[var(--color-action-primary)] px-1 mb-0.5">
              {name}
            </span>
          )}

          {hasText && (
            <div
              className={`${bubbleBase} border px-2.5 py-1.5 text-[14px] leading-relaxed max-w-full ${
                isSearchHit ? 'ring-2 ring-[var(--color-action-primary)]/35' : ''
              }`}
            >
              <MentionRichText
                text={message.content}
                users={users}
                assets={assets}
                className="text-[14px]"
              />
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span className="text-[11px] text-[var(--color-text-muted)] leading-none">{time}</span>
                {isOwn && (
                  <span className="text-[var(--color-action-primary)]">
                    {showRead ? <CheckCheck size={14} /> : <Check size={14} />}
                  </span>
                )}
              </div>
            </div>
          )}

          {images.length > 0 && (
            <div className="flex flex-col gap-1 w-full">
              {images.map((att, i) => (
                <ChatImageAttachment key={`${att.url || att.key}-${i}`} att={att} isOwn={isOwn} time={time} />
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="flex flex-col gap-1 w-full min-w-[12rem] max-w-xs">
              {files.map((att, i) => (
                <FileAttachment key={`${att.url || att.key}-${i}`} att={att} isOwn={isOwn} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function FileAttachment({ att, isOwn }) {
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-[var(--radius-lg)] border text-[12px] ${
        isOwn
          ? 'bg-[var(--color-action-primary)]/10 border-[var(--color-action-primary)]/25'
          : 'bg-[var(--color-bg-surface)] border-[var(--color-bg-border)] hover:bg-[var(--color-bg-secondary)]'
      }`}
    >
      <FileText size={16} className="shrink-0 text-[var(--color-text-muted)]" />
      <span className="truncate flex-1 min-w-0 text-[var(--color-text-primary)]">{att.name || 'File'}</span>
      <Download size={14} className="shrink-0 text-[var(--color-text-muted)]" />
    </a>
  );
}

function ChatImageAttachment({ att, isOwn, time }) {
  const [failed, setFailed] = useState(false);

  if (!att?.url || failed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-lg)] border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[11px] text-[var(--color-text-muted)]">
        <ImageIcon size={14} />
        <span className="truncate">{att?.name || 'Image unavailable'}</span>
      </div>
    );
  }

  return (
    <div className={`relative rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-bg-border)] max-w-xs ${isOwn ? 'ml-auto' : ''}`}>
      <a href={att.url} target="_blank" rel="noopener noreferrer">
        <img
          src={att.url}
          alt={att.name || 'Image'}
          loading="lazy"
          onError={() => setFailed(true)}
          className="block max-w-full max-h-72 object-cover bg-[var(--color-bg-workspace)]"
        />
      </a>
      {time && (
        <span className="absolute bottom-1 right-2 text-[11px] text-white/90 bg-black/40 px-1 rounded">
          {time}
        </span>
      )}
    </div>
  );
}

export default ChatMessageBubble;
