import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Inbox, CheckCheck, Shield, ListTodo } from 'lucide-react';
import { Card, Button, Badge, PageSkeleton, PageLoadGuard, DataLoading, EmptyState, ListPageLayout } from '../../components/ui';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead
} from '../../hooks/useTaskmasterQueries';
import { useNavigate } from 'react-router-dom';
import { parseActionUrl, applyFlashHighlight } from '../../utils/navigationHighlight';
import { formatInboxCategory } from '../../utils/displayLabels';

const NotificationAvatar = ({ notification: n }) => {
  if (n.iconType === 'user' && n.actorId?.avatar) {
    return (
      <img src={n.actorId.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-[var(--color-bg-border)] shrink-0" />
    );
  }
  if (n.iconType === 'user' && n.actorId?.name) {
    return (
      <div className="w-8 h-8 rounded-full bg-[var(--color-pastel-blue-bg)] text-[var(--color-pastel-blue-text)] flex items-center justify-center text-[10px] font-black shrink-0">
        {n.actorId.name.substring(0, 2).toUpperCase()}
      </div>
    );
  }
  if (n.iconType === 'task') {
    const color = n.relatedProjectId?.color || '#3b82f6';
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-[var(--color-bg-border)]" style={{ backgroundColor: `${color}22` }}>
        <ListTodo size={14} style={{ color }} />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center shrink-0 border border-[var(--color-bg-border)]">
      <Shield size={14} className="text-[var(--color-text-muted)]" />
    </div>
  );
};

const InboxPage = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications || (Array.isArray(data) ? data : []);
  const allowedCategories = data?.allowedCategories || ['all', 'task', 'review', 'crm', 'attendance', 'announcement', 'department', 'system'];

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter((n) => n.category === filter);

  const handleOpen = (n) => {
    if (!n.read) markRead.mutate(n._id);
    if (n.actionUrl) {
      const { path, highlightId } = parseActionUrl(n.actionUrl);
      navigate(path);
      if (highlightId) applyFlashHighlight(highlightId);
    }
  };

  return (
    <PageLoadGuard loading={isLoading && !notifications.length} skeleton={PageSkeleton} className="!py-4">
    <ListPageLayout
      containerClassName="!py-4"
      icon={Inbox}
      title="Inbox"
      toolbar={
        <div className="flex flex-nowrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-colors shrink-0 ${
              filter === 'all'
                ? 'bg-[var(--color-brand-teal)] text-white border-[var(--color-brand-teal)]'
                : 'border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:border-[var(--color-brand-teal)]/40'
            }`}
          >
            All
          </button>
          {allowedCategories.filter((cat) => cat !== 'all').map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-colors shrink-0 ${
                filter === cat
                  ? 'bg-[var(--color-brand-teal)] text-white border-[var(--color-brand-teal)]'
                  : 'border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:border-[var(--color-brand-teal)]/40'
              }`}
            >
              {formatInboxCategory(cat)}
            </button>
          ))}
        </div>
      }
      toolbarActions={
        <Button size="xs" variant="secondary" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
          <CheckCheck size={14} className="mr-1" /> Mark all read
        </Button>
      }
    >
      <Card className="divide-y divide-[var(--color-bg-border)]">
        {isLoading && <DataLoading />}
        {!isLoading && filtered.length === 0 && (
          <EmptyState title="No notifications" variant="subtle" className="!py-10" />
        )}
        {filtered.map((n) => (
          <button
            key={n._id}
            type="button"
            onClick={() => handleOpen(n)}
            className={`w-full text-left px-3 py-2 hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center gap-3 ${!n.read ? 'bg-[var(--color-brand-teal)]/5' : ''}`}
            title={n.message}
          >
            <NotificationAvatar notification={n} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-teal)] shrink-0" />}
                <span className="font-semibold text-xs truncate">{n.title}</span>
                <Badge variant="todo" className="!text-[8px] !py-0 shrink-0">{n.category || n.type}</Badge>
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">{n.message}</p>
            </div>
            <span className="text-[9px] text-[var(--color-text-muted)] shrink-0 whitespace-nowrap">
              {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
            </span>
          </button>
        ))}
      </Card>
    </ListPageLayout>
    </PageLoadGuard>
  );
};

export default InboxPage;


// Performance Optimization: useCallback(eventHandler) memoization guard
