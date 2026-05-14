import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { sendNotification } from '../utils/notifications';
import { Link } from 'react-router-dom';

const NotificationTray = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const trayRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get('/api/notifications');
      const data = res.data;
      
      // Check for new unread notifications to show browser alert
      const newUnread = data.filter(n => !n.read);
      if (newUnread.length > unreadCount) {
        const latest = newUnread[0];
        sendNotification(latest.title, latest.message);
      }
      
      setNotifications(data);
      setUnreadCount(newUnread.length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (trayRef.current && !trayRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    try {
      await axios.patch(`/api/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await axios.patch('/api/notifications/read-all');
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  return (
    <div className="relative" ref={trayRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] transition-all active:scale-95"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-[var(--color-bg-workspace)] animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-80 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)]/50">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-primary)]">Notifications</h3>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[10px] font-bold text-[var(--color-action-primary)] hover:underline">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="text-[var(--color-text-secondary)]">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-[var(--color-text-secondary)] text-sm">
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n._id}
                    className={`p-4 border-b border-[var(--color-bg-border)] transition-colors ${n.read ? 'opacity-60' : 'bg-[var(--color-action-primary)]/5'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-action-primary)]">
                        {n.type}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-secondary)]">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">{n.title}</h4>
                    <p className="text-xs text-[var(--color-text-secondary)] mb-3 leading-relaxed">{n.message}</p>
                    <div className="flex gap-2">
                      {!n.read && (
                        <button
                          onClick={() => markAsRead(n._id)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--color-bg-workspace)] text-[var(--color-text-primary)] text-[10px] font-bold hover:bg-[var(--color-bg-border)] transition-colors"
                        >
                          <Check size={12} /> Mark read
                        </button>
                      )}
                      {n.relatedLeadId && (
                        <Link
                          to={`/crm/leads?search=${n.relatedLeadId}`}
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--color-action-primary)] text-white text-[10px] font-bold hover:opacity-90 transition-opacity"
                        >
                          <ExternalLink size={12} /> View Lead
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationTray;
