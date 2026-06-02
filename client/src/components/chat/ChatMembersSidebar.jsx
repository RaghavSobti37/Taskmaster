import React from 'react';
import { X, Link2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import ChatAvatar from './ChatAvatar';
import { formatMemberPresence } from '../../utils/chatDisplay';

const MemberRow = ({ member, isSelf }) => (
  <li className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-lg)] hover:bg-[var(--color-bg-secondary)]/60">
    <ChatAvatar
      src={member.avatar}
      initials={(member.name || '?').charAt(0).toUpperCase()}
      isGroup={false}
      size={40}
      online={member.online}
    />
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">
        {member.name}
        {isSelf && (
          <span className="text-[11px] font-normal text-[var(--color-text-muted)] ml-1">(you)</span>
        )}
      </p>
      <p
        className={`text-[11px] truncate ${
          member.online ? 'text-[var(--color-action-primary)]' : 'text-[var(--color-text-muted)]'
        }`}
      >
        {formatMemberPresence(member)}
      </p>
    </div>
    {member.role === 'admin' && (
      <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] shrink-0">
        Admin
      </span>
    )}
  </li>
);

const SidebarPanel = ({ channelName, members, linkedProjects, currentUserId, onClose }) => (
  <aside className="flex flex-col h-full bg-[var(--color-bg-surface)] border-l border-[var(--color-bg-border)] w-full sm:w-[280px] shrink-0">
    <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--color-bg-border)] shrink-0">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">Members</h3>
        <p className="text-[11px] text-[var(--color-text-muted)] truncate">
          {channelName} · {members.length}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[var(--radius-lg)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] shrink-0"
        aria-label="Close members"
      >
        <X size={18} />
      </button>
    </div>

    {linkedProjects?.length > 0 && (
      <div className="px-3 py-3 border-b border-[var(--color-bg-border)] shrink-0">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
          Linked projects
        </p>
        <ul className="space-y-1.5">
          {linkedProjects.map((p) => (
            <li
              key={p._id}
              className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]"
            >
              <Link2 size={12} className="text-[var(--color-action-primary)] shrink-0" />
              <span className="truncate">{p.name}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    <ul className="flex-1 overflow-y-auto min-h-0 py-2 custom-scrollbar">
      {members.map((m) => (
        <MemberRow
          key={m._id}
          member={m}
          isSelf={currentUserId && String(m._id) === String(currentUserId)}
        />
      ))}
    </ul>
  </aside>
);

const ChatMembersSidebar = ({
  open,
  onClose,
  channel,
  members = [],
  currentUserId,
  overlay = false,
}) => {
  if (!open || !channel) return null;

  const channelName = channel.displayName || channel.name || 'Chat';
  const linked = channel.linkedProjects || [];

  if (overlay) {
    return createPortal(
      <div className="fixed inset-0 z-[100000] flex justify-end">
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="Close members"
          onClick={onClose}
        />
        <div className="relative h-full max-w-[min(100%,320px)] w-full shadow-xl">
          <SidebarPanel
            channelName={channelName}
            members={members}
            linkedProjects={linked}
            currentUserId={currentUserId}
            onClose={onClose}
          />
        </div>
      </div>,
      document.body
    );
  }

  return (
    <SidebarPanel
      channelName={channelName}
      members={members}
      linkedProjects={linked}
      currentUserId={currentUserId}
      onClose={onClose}
    />
  );
};

export default ChatMembersSidebar;
