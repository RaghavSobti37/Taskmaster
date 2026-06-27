import React, { useState, useMemo, useEffect } from 'react';
import { loadPageFilters, savePageFilters } from '../../utils/pageFilterStorage';
import RelativeTimestamp from '../../components/ui/RelativeTimestamp';
import { Inbox, CheckCheck, Shield, ListTodo, Bell, Trash2 } from 'lucide-react';
import ListPageLayout from '../../components/ui/ListPageLayout';
import PageLoadGuard from '../../components/ui/PageLoadGuard';
import PageSkeleton from '../../components/ui/PageSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import DataListRow from '../../components/ui/DataListRow';
import CountBadge from '../../components/ui/CountBadge';
import { DataLoading } from '../../components/ui/DataLoading';
import QueryErrorBanner, { getQueryErrorMessage } from '../../components/ui/QueryErrorBanner';
import { Button, Badge } from '../../components/ui/primitives';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useClearAllNotifications,
  useStatusCounts,
} from '../../hooks/useTaskmasterQueries';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/confirmContext';
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

const INBOX_FILTERS_KEY = 'inbox-filters';

const InboxPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState(() => loadPageFilters(INBOX_FILTERS_KEY, { filter: 'all' }).filter);

  useEffect(() => {
    savePageFilters(INBOX_FILTERS_KEY, { filter });
  }, [filter]);
  const { data, isLoading, isError, error, refetch } = useNotifications();
  const deferInboxSecondary = useDeferredQueryEnabled(!isLoading);
  const { data: statusCounts } = useStatusCounts(!!user && deferInboxSecondary);
  const { confirm } = useConfirm();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const clearAll = useClearAllNotifications();

  const notifications = data?.notifications || (Array.isArray(data) ? data : []);
  const allowedCategories = data?.allowedCategories || ['all', 'task', 'review', 'crm', 'attendance', 'announcement', 'department', 'system'];

  const unreadByCategory = useMemo(() => {
    const fromApi = statusCounts?.notifications?.byCategory || {};
    const fromList = notifications.reduce((acc, n) => {
      if (!n.read && n.category) {
        acc[n.category] = (acc[n.category] || 0) + 1;
      }
      return acc;
    }, {});
    return { ...fromList, ...fromApi };
  }, [notifications, statusCounts]);

  const unreadTotal = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const categoryUnread = (cat) => {
    if (cat === 'all') return unreadTotal;
    return unreadByCategory[cat] || 0;
  };

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

  const handleClearAll = async () => {
    if (!notifications.length) return;
    const ok = await confirm({
      title: 'Clear all notifications?',
      message: 'This permanently removes your notification history. This cannot be undone.',
      confirmLabel: 'Clear all',
      type: 'danger',
    });
    if (ok) clearAll.mutate();
  };

  const filterChipClass = (active) =>
    `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-colors shrink-0 ${
      active
        ? 'bg-[var(--color-brand-teal)] text-white border-[var(--color-brand-teal)]'
        : 'border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:border-[var(--color-brand-teal)]/40'
    }`;

  return (
    <PageLoadGuard loading={isLoading && !notifications.length} skeleton={PageSkeleton} className="!py-4">
    {isError && (
      <QueryErrorBanner
        message={getQueryErrorMessage(error, 'Failed to load notifications')}
        onRetry={() => refetch()}
        className="mx-4"
      />
    )}
    <ListPageLayout
      containerClassName="!py-4"
      overview={{
        stats: [
          {
            id: 'unread',
            label: 'Unread',
            value: statusCounts?.notifications?.unread ?? unreadTotal,
            icon: Bell,
            variant: 'rose',
            info: 'Notifications you have not opened yet.',
            onClick: () => setFilter('all'),
            active: filter === 'all',
          },
          {
            id: 'task',
            label: 'Task Alerts',
            value: categoryUnread('task'),
            icon: ListTodo,
            variant: 'info',
            info: 'Unread task assignments and updates.',
            onClick: () => setFilter(filter === 'task' ? 'all' : 'task'),
            active: filter === 'task',
          },
          {
            id: 'review',
            label: 'Reviews',
            value: categoryUnread('review'),
            icon: CheckCheck,
            variant: 'mint',
            info: 'Unread review and approval notifications.',
            onClick: () => setFilter(filter === 'review' ? 'all' : 'review'),
            active: filter === 'review',
          },
          {
            id: 'crm',
            label: 'CRM',
            value: categoryUnread('crm'),
            icon: Inbox,
            variant: 'apricot',
            info: 'Unread lead and follow-up notifications.',
            onClick: () => setFilter(filter === 'crm' ? 'all' : 'crm'),
            active: filter === 'crm',
          },
        ],
      }}
      toolbar={
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
          <button type="button" onClick={() => setFilter('all')} className={filterChipClass(filter === 'all')}>
            All
            {categoryUnread('all') > 0 && (
              <CountBadge count={categoryUnread('all')} size="sm" variant="teal" className="!border-transparent" />
            )}
          </button>
          {allowedCategories.filter((cat) => cat !== 'all').map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={filterChipClass(filter === cat)}
            >
              {formatInboxCategory(cat)}
              {categoryUnread(cat) > 0 && (
                <CountBadge count={categoryUnread(cat)} size="sm" variant={filter === cat ? 'teal' : 'rose'} className="!border-transparent" />
              )}
            </button>
          ))}
        </div>
      }
      toolbarActions={
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="xs"
            variant="secondary"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending || unreadTotal === 0}
          >
            <CheckCheck size={14} className="mr-1" /> Mark all read
          </Button>
          <Button
            size="xs"
            variant="secondary"
            onClick={handleClearAll}
            disabled={clearAll.isPending || notifications.length === 0}
          >
            <Trash2 size={14} className="mr-1" /> Clear all
          </Button>
        </div>
      }
    >
      <div className="min-w-0">
        {isLoading && <DataLoading />}
        {!isLoading && filtered.length === 0 && (
          <EmptyState title="No notifications" variant="subtle" className="!py-10" />
        )}
        {filtered.map((n) => (
          <DataListRow
            key={n._id}
            onClick={() => handleOpen(n)}
            className={!n.read ? 'bg-[var(--color-brand-teal)]/5' : ''}
            leading={<NotificationAvatar notification={n} />}
            primary={(
              <div className="flex items-center gap-2 min-w-0">
                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-teal)] shrink-0" />}
                <span className="font-semibold text-xs truncate">{n.title}</span>
                <Badge variant="todo" className="!text-[8px] !py-0 shrink-0">{n.category || n.type}</Badge>
              </div>
            )}
            secondary={(
              <p className="text-[10px] text-[var(--color-text-muted)] truncate">{n.message}</p>
            )}
            trailing={(
              <span className="text-[9px] text-[var(--color-text-muted)] whitespace-nowrap">
                <RelativeTimestamp value={n.createdAt} />
              </span>
            )}
          />
        ))}
      </div>
    </ListPageLayout>
    </PageLoadGuard>
  );
};

export default InboxPage;
