import React, { useMemo, useState } from 'react';
import { Plus, MessageCircle, Search } from 'lucide-react';
import ChatAvatar from './ChatAvatar';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import {
  formatChatListTime,
  getChannelListAvatar,
  getDmOtherUserId,
  isUserOnlineInList,
} from '../../utils/chatDisplay';

const ConversationRow = ({
  channel,
  active,
  onClick,
  currentUserId,
  users = [],
  compact = false,
}) => {
  const avatar = getChannelListAvatar(channel);
  const otherId = getDmOtherUserId(channel, currentUserId);
  const online = channel.type === 'dm' && isUserOnlineInList(users, otherId);
  const preview = channel.lastMessagePreview || 'No messages yet';
  const time = formatChatListTime(channel.lastMessageAt);
  const unread = channel.unreadCount > 0 && !active;

  return (
    <button
      type="button"
      onClick={() => onClick(channel)}
      className={`w-full text-left px-3 py-3 flex items-center gap-3 transition-colors border-b border-[var(--color-bg-border)] active:bg-[var(--color-bg-secondary)] ${
        active
          ? 'bg-[var(--color-bg-secondary)]'
          : 'hover:bg-[var(--color-bg-secondary)]/60'
      }`}
    >
      <ChatAvatar
        src={avatar.src}
        initials={avatar.initials}
        isGroup={avatar.isGroup}
        size={compact ? 44 : 49}
        online={online}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-medium text-[var(--color-text-primary)] truncate">
            {channel.displayName || channel.name}
          </span>
          {time && (
            <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">{time}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-[13px] text-[var(--color-text-secondary)] truncate">{preview}</p>
          {unread && (
            <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-action-primary)] text-white text-[11px] font-bold flex items-center justify-center">
              {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const ChatSidebar = ({
  conversations = [],
  activeChannelId,
  onSelectChannel,
  onNewChannel,
  onNewDm,
  currentUserId,
  isLoading,
  isError,
  errorMessage = '',
  className = '',
  compact = false,
}) => {
  const [search, setSearch] = useState('');
  const { data: users = [] } = useUserDirectory();
  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = (c.displayName || c.name || '').toLowerCase();
      const preview = (c.lastMessagePreview || '').toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }, [conversations, q]);

  return (
    <div
      className={`flex flex-col h-full border-r border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] w-full md:w-[340px] lg:w-[320px] shrink-0 ${className}`}
    >
      <div className="p-3 border-b border-[var(--color-bg-border)] shrink-0 space-y-3 bg-[var(--color-bg-surface)]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[var(--size-text-h4)] font-semibold text-[var(--color-text-primary)]">Chats</h2>
          <div className="flex items-center gap-1">
            {onNewDm && (
              <button
                type="button"
                onClick={onNewDm}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[var(--radius-lg)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]"
                title="New message"
                aria-label="New direct message"
              >
                <MessageCircle size={18} />
              </button>
            )}
            {onNewChannel && (
              <button
                type="button"
                onClick={onNewChannel}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-action-primary)] text-white hover:opacity-90 active:scale-95"
                title="New channel"
                aria-label="New channel"
              >
                <Plus size={18} />
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or start new chat"
            className="w-full pl-9 pr-3 py-2 rounded-[var(--radius-lg)] text-[14px] bg-[var(--color-bg-workspace)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] border border-[var(--color-bg-border)] outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar bg-[var(--color-bg-surface)]">
        {isError && (
          <div className="mx-3 mt-2 rounded-[var(--radius-lg)] border border-rose-500/30 bg-rose-500/10 px-2 py-2">
            <p className="text-[10px] text-rose-500 leading-relaxed">{errorMessage}</p>
          </div>
        )}
        {isLoading && filtered.length === 0 && (
          <p className="text-[12px] text-[var(--color-text-muted)] text-center py-12">Loading chats…</p>
        )}

        {filtered.map((ch) => (
          <ConversationRow
            key={ch._id}
            channel={ch}
            active={activeChannelId === ch._id}
            onClick={onSelectChannel}
            currentUserId={currentUserId}
            users={users}
            compact={compact}
          />
        ))}

        {!isLoading && filtered.length === 0 && !isError && (
          <div className="text-center py-14 px-4">
            <p className="text-[13px] text-[var(--color-text-muted)] mb-4">No conversations yet</p>
            {onNewChannel && (
              <button
                type="button"
                onClick={onNewChannel}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-lg)] text-[13px] font-semibold bg-[var(--color-action-primary)] text-white hover:opacity-90"
              >
                <Plus size={16} />
                Start chatting
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
