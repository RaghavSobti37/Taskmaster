import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard,
  Briefcase,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Calendar,
  Users,
  Plus,
  ChevronDown,
  Layers,
  Circle,
  MessageSquare,
  Database,
  ListTodo,
  X,
  Clock,
  Zap,
  UserCheck,
  RefreshCw,
  Bell,
  Moon,
  Sun,
  Building2,
  Contact,
  Trash2,
  Cloud,
  Globe,
  FileText
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';
import { Menu } from 'lucide-react';

import { useTheme } from '../contexts/ThemeContext';

const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return windowSize;
};

const NavItem = ({ to, icon: Icon, label, count, todayCount, collapsed, isMobile, onClick, end }) => (
  <NavLink
    to={to}
    end={end}
    onClick={onClick}
    className={({ isActive }) => `
      flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
      ${isActive
        ? 'bg-[var(--color-action-primary)] text-white shadow-lg shadow-blue-500/20'
        : 'hover:bg-[var(--color-bg-border)] text-[var(--color-text-secondary)]'}
    `}
  >
    <div className="relative flex items-center justify-center">
      <Icon size={20} className="shrink-0" />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse border-2 border-[var(--color-bg-surface)] shadow-[0_0_8px_rgba(244,63,94,0.5)] z-10"
          />
        )}
        {count === 0 && todayCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-[var(--color-bg-surface)] z-10"
          />
        )}
      </AnimatePresence>
    </div>
    <div className="flex-1 flex items-center justify-between min-w-0">
      <span className={`font-bold text-xs tracking-wide whitespace-nowrap overflow-hidden transition-[width] duration-300 ${(!collapsed || isMobile) ? 'w-auto' : 'w-0'}`}>
        {label}
      </span>
    </div>
  </NavLink>
);

const NavGroup = ({ title, icon: Icon, children, collapsed, isMobile, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col mb-4">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`flex items-center justify-between px-3 py-1 mb-1 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest hover:text-[var(--color-text-primary)] transition-colors focus:outline-none ${collapsed && !isMobile ? 'justify-center opacity-0' : 'opacity-100'}`}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} />}
          {(!collapsed || isMobile) && <span>{title}</span>}
        </div>
        {(!collapsed || isMobile) && (
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (!collapsed || isMobile) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden flex flex-col gap-0.5">
            {children}
          </motion.div>
        )}
        {(collapsed && !isMobile) && (
          <div className="flex flex-col gap-0.5 mt-1">
            {children}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ThemeToggle = ({ theme, toggleTheme }) => (
  <button
    onClick={toggleTheme}
    className="w-full flex items-center justify-between px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl hover:border-blue-500/50 transition-all group overflow-hidden"
  >
    <div className="flex items-center gap-3">
      <AnimatePresence mode="wait">
        {theme === 'light' ? (
          <motion.div
            key="sun"
            initial={{ y: 20, opacity: 0, rotate: -90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -20, opacity: 0, rotate: 90 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <Sun size={18} className="text-amber-500" />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ y: 20, opacity: 0, rotate: -90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -20, opacity: 0, rotate: 90 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <Moon size={18} className="text-blue-400" />
          </motion.div>
        )}
      </AnimatePresence>
      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-secondary)]">
        {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
      </span>
    </div>
    <div className={`w-8 h-4 bg-[var(--color-bg-border)] rounded-full relative transition-colors ${theme === 'dark' ? 'bg-blue-500/20' : ''}`}>
      <motion.div
        animate={{ x: theme === 'light' ? 2 : 18 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="absolute top-1 left-0 w-2 h-2 bg-[var(--color-text-secondary)] rounded-full shadow-sm"
      />
    </div>
  </button>
);

const OutletSidebar = () => {
  const { isOpen, toggleSidebar, isMobileOpen, closeMobileSidebar } = useSidebar();
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { width } = useWindowSize();
  const [notifications, setNotifications] = useState([]);
  const [statusCounts, setStatusCounts] = useState({
    tasks: { overdue: 0, today: 0 },
    followups: { overdue: 0, today: 0 },
    calendar: { today: 0 },
    notifications: { unread: 0 }
  });

  const fetchNotifications = async () => {
    try {
      const res = await axios.get('/api/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const fetchStatusCounts = async () => {
    try {
      const res = await axios.get('/api/notifications/status-counts');
      setStatusCounts(res.data);
    } catch (err) {
      console.error('Failed to fetch status counts:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchStatusCounts();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchStatusCounts();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const isMobile = width < 1024;

  useEffect(() => {
    closeMobileSidebar();
  }, [location]);

  const sidebarVariants = {
    open: { x: 0, width: 180 },
    collapsed: { x: 0, width: 180 },
    mobileOpen: { x: 0, width: 280 },
    mobileClosed: { x: -300, width: 280 }
  };

  return (
    <>
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeMobileSidebar}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={
          isMobile
            ? (isMobileOpen ? "mobileOpen" : "mobileClosed")
            : "open"
        }
        variants={sidebarVariants}
        className={`fixed left-0 top-0 h-screen bg-[var(--color-bg-surface)] border-r border-[var(--color-bg-border)] z-[70] flex flex-col shadow-2xl shadow-black/5 transition-[width,transform] duration-300 ease-in-out`}
      >
        <div className="p-3 py-5 flex items-center justify-between overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 shrink-0 bg-[var(--color-action-primary)] rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              CK
            </div>
            <span className={`font-bold text-xl tracking-tight text-[var(--color-text-primary)] transition-all duration-300 overflow-hidden ${(!isOpen && !isMobileOpen) ? 'w-0' : 'w-auto'}`}>
              CoreKnot
            </span>
          </div>

          <div className="flex items-center gap-1">
            {isMobileOpen && (
              <button
                onClick={closeMobileSidebar}
                className="lg:hidden p-1.5 hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-muted)] transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 px-3 mt-4 space-y-2 overflow-y-auto custom-scrollbar pb-6">
          <NavGroup title="Platform" collapsed={!isOpen} isMobile={isMobile}>
            <NavItem
              to="/dashboard"
              icon={LayoutDashboard}
              label="Dashboard"
              collapsed={!isOpen}
              isMobile={isMobile}
              onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['logs', user?._id], queryFn: async () => (await axios.get(`/api/logs?userId=${user?._id}`)).data })}
            />
            <NavItem
              to="/calendar"
              icon={Calendar}
              label="Calendar"
              collapsed={!isOpen}
              isMobile={isMobile}
              todayCount={statusCounts.calendar?.today}
              onMouseEnter={() => {
                queryClient.prefetchQuery({ queryKey: ['calendar'], queryFn: async () => (await axios.get('/api/calendar')).data });
                queryClient.prefetchQuery({ queryKey: ['holidays', new Date().getFullYear()], queryFn: async () => (await axios.get(`/api/google/holidays?year=${new Date().getFullYear()}`)).data });
              }}
            />
            <NavItem to="/logs" icon={Clock} label="Daily Logs" collapsed={!isOpen} isMobile={isMobile} />
          </NavGroup>

          <NavGroup title="Workspace" collapsed={!isOpen} isMobile={isMobile}>
            <NavItem
              to="/projects"
              icon={Briefcase}
              label="Projects"
              collapsed={!isOpen}
              isMobile={isMobile}
              onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['projects'], queryFn: async () => (await axios.get('/api/projects')).data })}
            />
            <NavItem
              to="/assets"
              end
              icon={Layers}
              label="Assets"
              collapsed={!isOpen}
              isMobile={isMobile}
              onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['assets'], queryFn: async () => (await axios.get('/api/assets')).data })}
            />
            <NavItem
              to="/office-assets"
              icon={Building2}
              label="Office"
              collapsed={!isOpen}
              isMobile={isMobile}
              onMouseEnter={() => {
                queryClient.prefetchQuery({ queryKey: ['office-assets'], queryFn: async () => (await axios.get('/api/office-assets')).data });
                queryClient.prefetchQuery({ queryKey: ['contacts'], queryFn: async () => (await axios.get('/api/contacts')).data });
              }}
            />
          </NavGroup>

          {(user?.role === 'admin' || user?.role === 'sales' || user?.role === 'artist_management') && (
            <NavGroup title="CRM" collapsed={!isOpen} isMobile={isMobile}>
              {(user?.role === 'admin' || user?.role === 'sales') && (
                <>
                  <NavItem
                    to="/leads"
                    icon={Users}
                    label="Leads"
                    collapsed={!isOpen}
                    isMobile={isMobile}
                    onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['leads'], queryFn: async () => (await axios.get('/api/crm/leads')).data })}
                  />
                  <NavItem
                    to="/followups"
                    icon={UserCheck}
                    label="Followups"
                    collapsed={!isOpen}
                    isMobile={isMobile}
                    count={statusCounts.followups.overdue}
                    todayCount={statusCounts.followups.today}
                    onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['leads'], queryFn: async () => (await axios.get('/api/crm/leads')).data })}
                  />
                </>
              )}
              {(user?.role === 'admin' || user?.role === 'artist_management') && (
                <NavItem
                  to="/artists"
                  icon={Users}
                  label="Artists"
                  collapsed={!isOpen}
                  isMobile={isMobile}
                  onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['artists'], queryFn: async () => (await axios.get('/api/artists')).data })}
                />
              )}
            </NavGroup>
          )}

          {(user?.role === 'admin' || user?.role === 'ops' || user?.role === 'operations' || user?.role === 'Operations') && (
            <NavGroup title="Management" collapsed={!isOpen} isMobile={isMobile}>
              <NavItem
                to="/finance"
                icon={FileText}
                label="Finance"
                collapsed={!isOpen}
                isMobile={isMobile}
                onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['finance-docs'], queryFn: async () => (await axios.get('/api/finance')).data })}
              />
              {user?.role === 'admin' && (
                <NavItem
                  to="/admin"
                  icon={ShieldCheck}
                  label="Admin Panel"
                  collapsed={!isOpen}
                  isMobile={isMobile}
                  onMouseEnter={() => {
                    queryClient.prefetchQuery({ queryKey: ['userDirectory'], queryFn: async () => (await axios.get('/api/users/directory')).data.users });
                    queryClient.prefetchQuery({ queryKey: ['teams'], queryFn: async () => (await axios.get('/api/teams')).data });
                  }}
                />
              )}
            </NavGroup>
          )}
        </nav>

        <div className="p-3 border-t border-[var(--color-bg-border)] space-y-2">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

          <div
            onClick={() => navigate('/settings')}
            className="w-full text-left group cursor-pointer"
          >
            <div className={`px-3 py-3 bg-[var(--color-bg-workspace)] rounded-2xl border border-[var(--color-bg-border)] group-hover:border-blue-500/50 transition-all duration-300 overflow-hidden`}>
              <div className="flex items-center gap-3">
                <div className="relative shrink-0 group/avatar">
                  <div className="w-9 h-9 rounded-xl bg-gray-200 overflow-hidden border border-[var(--color-bg-border)] z-10 relative">
                    {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold">{user?.name?.[0]}</div>}
                  </div>
                  {/* Gamification Ring */}
                  {user?.level && (
                    <>
                      <svg className="absolute -inset-1 w-11 h-11 -rotate-90 pointer-events-none" viewBox="0 0 44 44">
                        <circle cx="22" cy="22" r="20" fill="none" stroke="var(--color-bg-border)" strokeWidth="2" />
                        <circle
                          cx="22" cy="22" r="20"
                          fill="none"
                          stroke="var(--color-action-primary)"
                          strokeWidth="2"
                          strokeDasharray="125.6"
                          strokeDashoffset={125.6 - (125.6 * (Math.max(0, user.exp - (Math.floor(100 * Math.pow(user.level - 1, 1.5)))) / ((Math.floor(100 * Math.pow(user.level, 1.5))) - (Math.floor(100 * Math.pow(user.level - 1, 1.5)))))) || 0}
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-[8px] font-black px-1 rounded-sm shadow-sm z-20">
                        {user.level}
                      </div>
                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-black text-white text-[8px] font-bold rounded opacity-0 group-hover/avatar:opacity-100 pointer-events-none whitespace-nowrap z-30 transition-opacity">
                        Level {user.level} • {user.exp} / {Math.floor(100 * Math.pow(user.level, 1.5))} XP
                      </div>
                    </>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-tight truncate group-hover:text-blue-500 transition-colors">{user.name}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">{user.role}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.reload();
                      }}
                      title="Refresh"
                      className="p-1 hover:bg-[var(--color-bg-border)] rounded text-blue-500 transition-colors"
                    >
                      <RefreshCw size={10} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] text-green-500 font-bold uppercase tracking-widest">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    Online
                  </div>
                </div>
              </div>
            </div>
          </div>
          <NavItem to="/settings" icon={Settings} label="Settings" collapsed={!isOpen} isMobile={isMobile} />
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut size={22} className="shrink-0" />
            <span className={`font-bold text-sm transition-all duration-300 overflow-hidden ${(!isOpen && !isMobileOpen) ? 'w-0' : 'w-auto'}`}>Log Out</span>
          </button>
        </div>
      </motion.aside>
    </>
  );
};

export default OutletSidebar;
