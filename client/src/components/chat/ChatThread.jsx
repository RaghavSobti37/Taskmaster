import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Loader2,
  MessageSquare,
  Check,
  X,
  Search,
  MoreVertical,
  ChevronLeft,
  Users,
} from 'lucide-react';
import ChatMessageBubble from './ChatMessageBubble';
import ChatComposer from './ChatComposer';
import ChatAvatar from './ChatAvatar';
import EditChannelProjectsModal from './EditChannelProjectsModal';
import ChatThreadMenu from './ChatThreadMenu';
import ChatMembersSidebar from './ChatMembersSidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  useChatMessages,
  useSendChatMessage,
  useMarkChatRead,
  useLoadOlderMessages,
  useUpdateChatChannel,
} from '../../hooks/useChat';
import { useChatChannelRealtime, useEmitChatTyping } from '../../hooks/useChatRealtime';
import {
  getChannelListAvatar,
  getHeaderStatus,
  getChatHeaderStyle,
  groupMessagesWithDates,
  getChannelMembers,
  getChannelMentionUsers,
} from '../../utils/chatDisplay';

const fetchAssets = async () => {
  const { data } = await axios.get('/api/assets', { headers: { 'x-skip-toast': 'true' } });
  return Array.isArray(data) ? data : [];
};

const isChannelAdmin = (channel, userId) => {
  if (!channel || !userId) return false;
  const uid = String(userId);
  if (String(channel.createdBy?._id || channel.createdBy) === uid) return true;
  return (channel.members || []).some(
    (m) => String(m.user?._id || m.user) === uid && m.role === 'admin'
  );
};

const EmptyThreadHints = () => (
  <div className="flex flex-col gap-3 px-4 sm:px-6 py-8 max-w-md mx-auto opacity-50 pointer-events-none select-none">
    <div className="flex justify-start">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-[var(--radius-lg)] rounded-bl-sm px-3 py-2 text-[13px] text-[var(--color-text-secondary)] max-w-[85%]">
        Pick a conversation or send a message to get started.
      </div>
    </div>
    <div className="flex justify-end">
      <div className="bg-[var(--color-action-primary)]/14 border border-[var(--color-action-primary)]/25 rounded-[var(--radius-lg)] rounded-br-sm px-3 py-2 text-[13px] text-[var(--color-text-primary)] max-w-[85%]">
        Your team chat uses the same theme as the rest of CoreKnot.
      </div>
    </div>
  </div>
);

const ChatThread = ({ channel, onChannelUpdated, onBack, className = '', compact = false }) => {
  const { user } = useAuth();
  const channelId = channel?._id;
  const { data: messages = [], isLoading } = useChatMessages(channelId);
  const sendMutation = useSendChatMessage(channelId);
  const markRead = useMarkChatRead(channelId);
  const loadOlder = useLoadOlderMessages(channelId);
  const updateChannel = useUpdateChatChannel(channelId);
  const { data: users = [] } = useUserDirectory();
  const { data: assets = [] } = useQuery({
    queryKey: ['assets', 'mention-picker'],
    queryFn: fetchAssets,
    staleTime: 1000 * 60 * 5,
  });

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [showEditProjects, setShowEditProjects] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const menuBtnRef = useRef(null);
  const searchInputRef = useRef(null);

  const scrollRef = useRef(null);
  const [typingUser, setTypingUser] = useState(null);
  const emitTyping = useEmitChatTyping(channelId, user?.name);
  const typingTimeoutRef = useRef(null);

  const channelMembers = useMemo(
    () => (channel ? getChannelMembers(channel, users) : []),
    [channel, users]
  );

  const mentionUsers = useMemo(
    () => (channel ? getChannelMentionUsers(channel, users, user?._id) : null),
    [channel, users, user?._id]
  );

  const timeline = useMemo(() => groupMessagesWithDates(messages), [messages]);

  const displayTimeline = useMemo(() => {
    const q = messageSearch.trim().toLowerCase();
    if (!q) return timeline;
    return timeline.filter((item) => {
      if (item.type !== 'message') return false;
      return String(item.message.content || '').toLowerCase().includes(q);
    });
  }, [timeline, messageSearch]);

  const searchMatchCount = useMemo(() => {
    if (!messageSearch.trim()) return 0;
    return displayTimeline.length;
  }, [displayTimeline, messageSearch]);

  useEffect(() => {
    setEditingTitle(false);
    setMenuOpen(false);
    setMembersOpen(false);
    setMessageSearchOpen(false);
    setMessageSearch('');
    setTitleDraft(channel?.displayName || channel?.name || '');
  }, [channel?._id, channel?.displayName, channel?.name]);

  useEffect(() => {
    if (messageSearchOpen) searchInputRef.current?.focus();
  }, [messageSearchOpen]);

  const handleTyping = useCallback((payload) => {
    if (!payload?.userId || payload.userId === user?._id) return;
    setTypingUser(payload.name || 'Someone');
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
  }, [user?._id]);

  useChatChannelRealtime(channelId, undefined, handleTyping);

  useEffect(() => {
    if (!channelId) return;
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, channelId]);

  useEffect(() => {
    if (!messageSearch.trim() || !displayTimeline.length) return;
    const firstKey = displayTimeline[0]?.key;
    if (!firstKey) return;
    const node = scrollRef.current?.querySelector(`[data-msg-key="${firstKey}"]`);
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [messageSearch, displayTimeline]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || loadOlder.isPending || messageSearch.trim()) return;
    if (el.scrollTop < 80 && messages.length > 0) {
      const oldest = messages[0];
      if (oldest?._id) loadOlder.mutate(oldest._id);
    }
  };

  const handleSend = async (payload) => {
    await sendMutation.mutateAsync(payload);
    markRead.mutate();
    emitTyping();
  };

  const closeMessageSearch = () => {
    setMessageSearchOpen(false);
    setMessageSearch('');
  };

  const canRename = channel && channel.type !== 'dm';
  const canEditLinks = channel?.type === 'group' && isChannelAdmin(channel, user?._id);

  const saveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || !canRename) {
      setEditingTitle(false);
      return;
    }
    try {
      const updated = await updateChannel.mutateAsync({ name: trimmed });
      onChannelUpdated?.(updated);
      setEditingTitle(false);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Could not rename channel');
    }
  };

  const saveProjectLinks = async ({ projectIds }) => {
    try {
      const updated = await updateChannel.mutateAsync({ projectIds });
      onChannelUpdated?.(updated);
      setShowEditProjects(false);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Could not update linked projects');
    }
  };

  if (!channel) {
    return (
      <div
        className={`flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center bg-[var(--color-bg-workspace)]/40 ${className}`}
      >
        <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] flex items-center justify-center">
          <MessageSquare size={32} className="text-[var(--color-text-muted)]" />
        </div>
        <p className="text-[var(--color-text-primary)] text-lg font-semibold">Select a conversation</p>
        <p className="text-[var(--color-text-muted)] text-[13px] max-w-sm leading-relaxed">
          Choose a chat from the list, or use <strong className="text-[var(--color-text-secondary)]">+</strong> to start a new channel or message.
        </p>
      </div>
    );
  }

  const headerAvatar = getChannelListAvatar(channel);
  const status = getHeaderStatus(channel, users, user?._id);
  const headerStyle = getChatHeaderStyle(channel);
  const lastOwnId = [...messages].reverse().find(
    (m) => m.senderId?._id === user?._id || m.senderId === user?._id
  )?._id;

  const showChannelMenu = canRename || canEditLinks;

  return (
    <div className={`flex flex-1 min-w-0 h-full bg-[var(--color-bg-workspace)]/30 ${className}`}>
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
      <header
        className="px-2 sm:px-4 py-2 sm:py-3 shrink-0 flex items-center gap-2 sm:gap-3 border-b border-[var(--color-bg-border)]"
        style={headerStyle}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[var(--radius-lg)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] shrink-0"
            aria-label="Back to chats"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        <ChatAvatar
          src={headerAvatar.src}
          initials={headerAvatar.initials}
          isGroup={headerAvatar.isGroup}
          size={40}
          online={status === 'Online'}
        />
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <div className="flex items-center gap-1">
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="flex-1 text-sm font-semibold px-2 py-1.5 rounded-[var(--radius-lg)] bg-[var(--color-bg-workspace)] text-[var(--color-text-primary)] border border-[var(--color-bg-border)] outline-none focus:ring-2 focus:ring-[var(--ring)]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
              />
              <button
                type="button"
                onClick={saveTitle}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--color-action-primary)]"
                aria-label="Save name"
              >
                <Check size={16} />
              </button>
              <button
                type="button"
                onClick={() => setEditingTitle(false)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--color-text-muted)]"
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {channel.displayName || channel.name}
            </h2>
          )}
          <p className="text-[12px] text-[var(--color-text-muted)] truncate">
            {typingUser ? `${typingUser} is typing…` : status}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 text-[var(--color-text-secondary)]">
          <button
            type="button"
            onClick={() => {
              setMessageSearchOpen((o) => !o);
              if (messageSearchOpen) closeMessageSearch();
            }}
            className={`p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[var(--radius-lg)] ${
              messageSearchOpen
                ? 'bg-[var(--color-bg-secondary)] text-[var(--color-action-primary)]'
                : 'hover:bg-[var(--color-bg-secondary)]'
            }`}
            title="Search messages"
            aria-label="Search messages"
            aria-pressed={messageSearchOpen}
          >
            <Search size={18} />
          </button>
          <button
            type="button"
            onClick={() => setMembersOpen((o) => !o)}
            className={`p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[var(--radius-lg)] ${
              membersOpen
                ? 'bg-[var(--color-bg-secondary)] text-[var(--color-action-primary)]'
                : 'hover:bg-[var(--color-bg-secondary)]'
            }`}
            title="Members"
            aria-label="Toggle members"
            aria-pressed={membersOpen}
          >
            <Users size={18} />
          </button>
          {showChannelMenu && (
            <button
              ref={menuBtnRef}
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className={`p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[var(--radius-lg)] ${
                menuOpen ? 'bg-[var(--color-bg-secondary)]' : 'hover:bg-[var(--color-bg-secondary)]'
              }`}
              title="Channel options"
              aria-label="Channel options"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={18} />
            </button>
          )}
        </div>
      </header>

      {messageSearchOpen && (
        <div className="px-3 py-2 shrink-0 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] flex items-center gap-2">
          <Search size={16} className="text-[var(--color-text-muted)] shrink-0" />
          <input
            ref={searchInputRef}
            value={messageSearch}
            onChange={(e) => setMessageSearch(e.target.value)}
            placeholder="Search in this chat…"
            className="flex-1 min-w-0 py-2 text-[14px] bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none"
          />
          {messageSearch.trim() && (
            <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">
              {searchMatchCount === 0 ? 'No matches' : `${searchMatchCount} found`}
            </span>
          )}
          <button
            type="button"
            onClick={closeMessageSearch}
            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-[var(--radius-lg)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
            aria-label="Close search"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <ChatThreadMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={menuBtnRef}
        canRename={canRename}
        canEditLinks={canEditLinks}
        onRename={() => setEditingTitle(true)}
        onEditLinks={() => setShowEditProjects(true)}
      />

      <EditChannelProjectsModal
        open={showEditProjects}
        onClose={() => setShowEditProjects(false)}
        channel={channel}
        onSave={saveProjectLinks}
        loading={updateChannel.isPending}
      />

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-8 py-3 sm:py-4 min-h-0 overscroll-contain"
      >
        {loadOlder.isPending && !messageSearch.trim() && (
          <div className="flex justify-center py-2">
            <Loader2 size={16} className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        )}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 size={22} className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        )}
        {!isLoading && messages.length === 0 && <EmptyThreadHints />}
        {!isLoading && messages.length > 0 && messageSearch.trim() && searchMatchCount === 0 && (
          <p className="text-center text-[13px] text-[var(--color-text-muted)] py-8">
            No messages match &ldquo;{messageSearch.trim()}&rdquo;
          </p>
        )}
        {!isLoading &&
          displayTimeline.map((item) => {
            if (item.type === 'date') {
              return (
                <div key={item.key} className="flex justify-center my-3">
                  <span className="text-[12px] text-[var(--color-text-muted)] bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] px-3 py-1 rounded-[var(--radius-lg)]">
                    {item.label}
                  </span>
                </div>
              );
            }
            const msg = item.message;
            const isOwn = msg.senderId?._id === user?._id || msg.senderId === user?._id;
            return (
              <div key={item.key} data-msg-key={item.key}>
                <ChatMessageBubble
                  message={msg}
                  users={users}
                  assets={assets}
                  isOwn={isOwn}
                  showRead={isOwn && msg._id === lastOwnId}
                  highlightQuery={messageSearch.trim()}
                />
              </div>
            );
          })}
      </div>

      <ChatComposer
        onSend={handleSend}
        sending={sendMutation.isPending}
        mentionUsers={mentionUsers}
      />
      </div>

      {membersOpen && (
        <ChatMembersSidebar
          open={membersOpen}
          onClose={() => setMembersOpen(false)}
          channel={channel}
          members={channelMembers}
          currentUserId={user?._id}
          overlay={compact}
        />
      )}
    </div>
  );
};

export default ChatThread;
