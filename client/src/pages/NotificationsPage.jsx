import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, ExternalLink, Filter, Calendar, Briefcase, ListTodo, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { PageContainer, PageHeader, Card, Badge } from '../components/ui';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const fetchNotifications = async () => {
    try {
      const res = await axios.get('/api/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id) => {
    try {
      await axios.patch(`/api/notifications/${id}/read`);
      setNotifications(notifications.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await axios.patch('/api/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await axios.delete(`/api/notifications/${id}`);
      setNotifications(notifications.filter(n => n._id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'PROJECT': return Briefcase;
      case 'TASK': return ListTodo;
      case 'CRM': return UserCheck;
      default: return Bell;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'PROJECT': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'TASK': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      case 'CRM': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    }
  };

  const filteredNotifications = notifications.filter(n => 
    filter === 'ALL' ? true : n.type === filter
  );

  return (
    <PageContainer maxWidth="1200px">
      <PageHeader
        icon={Bell}
        title="Notifications"
        subtitle="Stay updated with your latest activities and assignments."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={markAllRead}
              className="px-4 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[var(--color-bg-workspace)] transition-all"
            >
              Mark all read
            </button>
          </div>
        }
      />

      <div className="max-w-4xl mx-auto">
        <Card className="overflow-hidden min-h-[600px]">
          <div className="divide-y divide-[var(--color-bg-border)]">
            {loading ? (
              <div className="p-20 text-center text-[var(--color-text-muted)] italic text-sm">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-20 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                <Bell size={48} className="text-[var(--color-text-muted)]" />
                <p className="text-[10px] font-black uppercase tracking-widest">No notifications found</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {notifications.map((n) => {
                  const Icon = getTypeIcon(n.type);
                  return (
                    <motion.div
                      key={n._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className={`p-6 flex items-start gap-5 transition-all hover:bg-black/[0.02] ${!n.read ? 'bg-blue-500/[0.03]' : ''}`}
                    >
                      <div className={`p-3 rounded-2xl border ${getTypeColor(n.type)}`}>
                        <Icon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">{n.type}</span>
                          <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{format(new Date(n.createdAt), 'MMM d, h:mm a')}</span>
                        </div>
                        <h4 className="text-sm font-black text-[var(--color-text-primary)] mb-1">{n.title}</h4>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-4">{n.message}</p>
                        
                        <div className="flex items-center gap-3">
                          {!n.read && (
                            <button
                              onClick={() => markAsRead(n._id)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all"
                            >
                              <Check size={12} /> Mark read
                            </button>
                          )}
                          {n.relatedLeadId && (
                            <Link
                              to={`/leads?search=${n.relatedLeadId}`}
                              className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-[10px] font-black uppercase tracking-widest hover:border-blue-500 hover:text-blue-500 transition-all"
                            >
                              <ExternalLink size={12} /> View Lead
                            </Link>
                          )}
                          <button
                            onClick={() => deleteNotification(n._id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all ml-auto"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
};

export default NotificationsPage;
