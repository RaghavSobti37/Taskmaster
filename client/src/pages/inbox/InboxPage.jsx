import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Button, Badge, SearchInput } from '../../components/ui';
import { countActiveFilters } from '../../components/ui/selectionFilterUtils';
import { useDebounce } from '../../hooks/useDebounce';
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
const INBOX_FILTER_DEFAULTS = { filter: 'all', search: '', sortBy: 'newest' };

const InboxPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const saved = useMemo(() => loadPageFilters(INBOX_FILTERS_KEY, INBOX_FILTER_DEFAULTS), []);
  const [filter, setFilter] = useState(saved.filter);
  const [search, setSearch] = useState(saved.search || '');
  const [sortBy, setSortBy] = useState(saved.sortBy || 'newest');
  const debouncedSearch = useDebounce(search, 200);

  useEffect(() => {
    savePageFilters(INBOX_FILTERS_KEY, { filter, search, sortBy });
  }, [filter, search, sortBy]);
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

  const filtered = useMemo(() => {
    let list = filter === 'all'
      ? notifications
      : notifications.filter((n) => n.category === filter);

    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((n) => {
        const hay = [
          n.title,
          n.message,
          n.actorId?.name,
          n.relatedProjectId?.name,
          n.category,
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }

    const sorted = [...list];
    if (sortBy === 'unread-first') {
      sorted.sort((a, b) => Number(a.read) - Number(b.read) || new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'oldest') {
      sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else {
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return sorted;
  }, [notifications, filter, debouncedSearch, sortBy]);

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

  const inboxFilterFields = useMemo(() => ([
    {
      id: 'category',
      label: 'Category',
      type: 'radio',
      value: filter,
      defaultValue: 'all',
      options: allowedCategories.map((cat) => ({ value: cat, label: formatInboxCategory(cat) })),
      onChange: setFilter,
    },
    {
      id: 'sortBy',
      label: 'Sort by',
      type: 'radio',
      value: sortBy,
      defaultValue: 'newest',
      options: [
        { value: 'newest', label: 'Newest first' },
        { value: 'oldest', label: 'Oldest first' },
        { value: 'unread-first', label: 'Unread first' },
      ],
      onChange: setSortBy,
    },
  ]), [filter, sortBy, allowedCategories]);

  const handleClearInboxFilters = useCallback(() => {
    setFilter('all');
    setSortBy('newest');
  }, []);

  const filterChipClass = (active) =>
    `inline-flex items-center gap-1.5 px-2.5 min-h-[44px] py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-colors shrink-0 ${
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
      toolbarFill
      filterFields={inboxFilterFields}
      filterSheetTitle="Inbox filters"
      mobileFilterCount={countActiveFilters(inboxFilterFields)}
      onActiveFiltersClear={handleClearInboxFilters}
      searchBar={(
        <SearchInput
          variant="toolbar"
          placeholder="Search notifications…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-full"
        />
      )}
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
