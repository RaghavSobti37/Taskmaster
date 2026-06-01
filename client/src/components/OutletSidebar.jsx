import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useStatusCounts } from '../hooks/useTaskmasterQueries';
import {
  LayoutDashboard,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarClock,
  ListTodo,
  Inbox,
  FolderArchive,
  NotebookPen,
  Mail,
  Wrench,
  Contact,
  ClipboardCheck,
  UserPlus,
  PhoneCall,
  CalendarCheck,
  CircleDollarSign,
  Megaphone,
  Mic2,
  Users,
  Database,
  BarChart2,
  Brackets,
  Trophy,
  Activity,
  ChevronDown,
  CreditCard,
  X,
  Moon,
  Sun,
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';
import { hasPageAccess, groupHasVisiblePages, getDepartmentName } from '../utils/departmentPermissions';
import { Menu, Settings } from 'lucide-react';
import { useNavbarPreferences } from '../hooks/useTaskmasterQueries';

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

const LEGACY_PAGE_PATHS = {
  '/workspace/emails': '/emails',
  '/workspace/emails/create': '/emails/create',
  '/management/equipment': '/equipment',
  '/management/contacts': '/contacts',
  '/office/subscriptions': '/subscriptions',
  '/management/announcements': '/announcements',
  '/management/ops-logs': '/ops-logs',
  '/management/attendance': '/attendance',
  '/projects/workspaces': '/workspaces',
};

const normalizeNavPagePath = (path) => {
  if (!path) return path;
  if (LEGACY_PAGE_PATHS[path]) return LEGACY_PAGE_PATHS[path];
  const workspaceMatch = path.match(/^\/projects\/workspaces\/(.+)$/);
  if (workspaceMatch) return `/workspaces/${workspaceMatch[1]}`;
  return path;
};

const PAGE_CONFIG = {
  '/dashboard': { icon: LayoutDashboard, label: 'Dashboard', accessKey: 'dashboard' },
  '/calendar': { icon: CalendarDays, label: 'Calendar', accessKey: 'calendar' },
  '/todo': { icon: ListTodo, label: 'Todo', accessKey: 'todo' },
  '/inbox': { icon: Inbox, label: 'Inbox', accessKey: 'inbox' },
  '/projects': { icon: Briefcase, label: 'Projects', accessKey: 'projects' },
  '/assets': { icon: FolderArchive, label: 'Assets', accessKey: 'assets', end: true },
  '/schedule': { icon: CalendarClock, label: 'Schedule', accessKey: 'schedule' },
  '/logs': { icon: NotebookPen, label: 'Daily Logs', accessKey: 'logs' },
  '/emails': { icon: Mail, label: 'Emails', accessKey: 'emails' },
  '/equipment': { icon: Wrench, label: 'Equipment', accessKey: 'equipment' },
  '/contacts': { icon: Contact, label: 'Contacts', accessKey: 'contacts' },
  '/subscriptions': { icon: CreditCard, label: 'Subscriptions', accessKey: 'subscriptions' },
  '/attendance': { icon: ClipboardCheck, label: 'Attendance', accessKey: 'attendance' },
  '/leads': { icon: UserPlus, label: 'Leads', accessKey: 'leads' },
  '/followups': { icon: PhoneCall, label: 'Followups', accessKey: 'followups' },
  '/bookings': { icon: CalendarCheck, label: 'Bookings', accessKey: 'bookings' },
  '/finance': { icon: CircleDollarSign, label: 'Finance', accessKey: 'finance' },
  '/announcements': { icon: Megaphone, label: 'Announcements', accessKey: 'announcements' },
  '/ops-logs': { icon: Activity, label: 'Ops Logs', accessKey: 'ops_logs' },
  '/artists': { icon: Mic2, label: 'Artists', accessKey: 'artists' },
  '/admin/users': { icon: Users, label: 'Users & Teams', accessKey: 'admin_users' },
  '/admin': { icon: Database, label: 'All Data', accessKey: 'admin_data', end: true },
  '/admin/exly-campaigns': { icon: BarChart2, label: 'Exly Data', accessKey: 'admin_exly' },
  '/admin/scripts': { icon: Brackets, label: 'Script Runner', accessKey: 'admin_scripts' },
  '/admin/gamification': { icon: Trophy, label: 'Gamification', accessKey: 'admin_gamification' },
  '/admin/qa': { icon: Activity, label: 'QA Testing', accessKey: 'admin_data' },
};

const NavItem = ({ to, icon: Icon, label, count, todayCount, collapsed, isMobile, onClick, end }) => {
  const location = useLocation();
  const isActive = end
    ? location.pathname === to.split('?')[0] && location.search === (to.includes('?') ? '?' + to.split('?')[1] : '')
    : location.pathname.startsWith(to.split('?')[0]);
  const iconOnly = collapsed && !isMobile;

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      title={iconOnly ? label : undefined}
      className={({ isActive: navIsActive }) => {
        const active = end ? isActive : navIsActive;
        return `
        flex items-center rounded-lg transition-all duration-200 relative
        ${iconOnly ? 'justify-center px-2 py-2 gap-0' : 'gap-2.5 px-2.5 py-1.5'}
        ${active
            ? 'bg-[var(--color-action-primary)] text-white shadow-md shadow-blue-500/15'
            : 'hover:bg-[var(--color-bg-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}
      `;
      }}
    >
      <div className="relative flex items-center justify-center shrink-0">
        <Icon size={18} className="shrink-0" />
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
      {(!collapsed || isMobile) && (
        <span className="flex-1 min-w-0 font-semibold text-[11px] tracking-wide truncate">
          {label}
        </span>
      )}
    </NavLink>
  );
};

const NavGroup = ({ title, icon: Icon, children, collapsed, isMobile, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const iconOnly = collapsed && !isMobile;
  return (
    <div className="flex flex-col mb-2">
      {!iconOnly && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between px-2 py-0.5 mb-0.5 text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider hover:text-[var(--color-text-primary)] transition-colors focus:outline-none"
        >
          <div className="flex items-center gap-1.5">
            {Icon && <Icon size={12} />}
            <span>{title}</span>
          </div>
          <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}
      <AnimatePresence>
        {isOpen && (!collapsed || isMobile) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden flex flex-col gap-0.5">
            {children}
          </motion.div>
        )}
        {iconOnly && (
          <div className="flex flex-col gap-0.5">
            {children}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ThemeToggle = ({ theme, toggleTheme, collapsed, isMobile }) => {
  const iconOnly = collapsed && !isMobile;
  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'light' ? 'Light mode' : 'Dark mode'}
        className="w-full flex items-center justify-center p-2 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] hover:border-[var(--color-action-primary)]/40 transition-colors"
      >
        {theme === 'light' ? <Sun size={16} className="text-amber-500" /> : <Moon size={16} className="text-blue-400" />}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="w-full flex items-center justify-between px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg hover:border-blue-500/50 transition-all group overflow-hidden"
    >
      <div className="flex items-center gap-2">
        <AnimatePresence mode="wait">
          {theme === 'light' ? (
            <motion.div
              key="sun"
              initial={{ y: 20, opacity: 0, rotate: -90 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: -20, opacity: 0, rotate: 90 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              <Sun size={16} className="text-amber-500" />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ y: 20, opacity: 0, rotate: -90 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: -20, opacity: 0, rotate: 90 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              <Moon size={16} className="text-blue-400" />
            </motion.div>
          )}
        </AnimatePresence>
        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {theme === 'light' ? 'Light' : 'Dark'}
        </span>
      </div>
      <div className={`w-7 h-3.5 bg-[var(--color-bg-border)] rounded-full relative transition-colors ${theme === 'dark' ? 'bg-blue-500/20' : ''}`}>
        <motion.div
          animate={{ x: theme === 'light' ? 2 : 18 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="absolute top-0.5 left-0 w-2 h-2 bg-[var(--color-text-secondary)] rounded-full shadow-sm"
        />
      </div>
    </button>
  );
};

const OutletSidebar = () => {
  const { isOpen, toggleSidebar, isMobileOpen, closeMobileSidebar } = useSidebar();
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { width } = useWindowSize();
  const { data: navbarPreferences } = useNavbarPreferences();
  const { data: statusCounts = {
    tasks: { overdue: 0, today: 0 },
    followups: { overdue: 0, today: 0 },
    calendar: { today: 0 },
    notifications: { unread: 0 }
  } } = useStatusCounts(!!user);

  const isMobile = width < 1024;

  useEffect(() => {
    closeMobileSidebar();
  }, [location]);

  const sidebarVariants = {
    open: { x: 0, width: 160 },
    collapsed: { x: 0, width: 56 },
    mobileOpen: { x: 0, width: 260 },
    mobileClosed: { x: -280, width: 260 },
  };

  const showLabels = isMobile ? isMobileOpen : isOpen;

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
            ? (isMobileOpen ? 'mobileOpen' : 'mobileClosed')
            : (isOpen ? 'open' : 'collapsed')
        }
        variants={sidebarVariants}
        className={`fixed left-0 top-0 h-screen bg-[var(--color-bg-surface)] border-r border-[var(--color-bg-border)] z-[70] flex flex-col shadow-2xl shadow-black/5 transition-[width,transform] duration-300 ease-in-out`}
      >
        <div className={`flex items-center overflow-hidden border-b border-[var(--color-bg-border)] ${showLabels ? 'p-2.5 justify-between' : 'p-2 justify-center flex-col gap-2'}`}>
          <div className={`flex items-center min-w-0 ${showLabels ? 'gap-2' : ''}`}>
            <img src="/favicon.png" alt="Coreknot Logo" className="w-7 h-7 shrink-0 rounded-md shadow-md shadow-purple-500/20 object-cover" />
            {showLabels && (
              <span className="font-bold text-sm tracking-tight text-[var(--color-text-primary)] truncate">
                Coreknot
              </span>
            )}
          </div>

          <div className={`flex items-center shrink-0 ${showLabels ? 'gap-0.5' : 'flex-col gap-1'}`}>
            {!isMobile && (
              <button
                type="button"
                onClick={toggleSidebar}
                title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                className="p-1.5 hover:bg-[var(--color-bg-border)] rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            {isMobileOpen && (
              <button
                type="button"
                onClick={closeMobileSidebar}
                className="lg:hidden p-1.5 hover:bg-[var(--color-bg-border)] rounded-md text-[var(--color-text-muted)] transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 px-2 mt-2 space-y-1 overflow-y-auto custom-scrollbar pb-4">
          {(() => {
            const rawGroups = navbarPreferences?.groups && navbarPreferences.groups.length > 0 ? navbarPreferences.groups : [
              { id: 'platform', title: 'Platform', visible: true, pages: [{ path: '/dashboard' }, { path: '/calendar' }, { path: '/todo' }, { path: '/inbox' }] },
              { id: 'workspace', title: 'Workspace', visible: true, pages: [{ path: '/projects' }, { path: '/assets' }, { path: '/schedule' }, { path: '/logs' }, { path: '/emails' }] },
              { id: 'office', title: 'Office', visible: true, pages: [{ path: '/equipment' }, { path: '/contacts' }, { path: '/attendance' }, { path: '/subscriptions' }] },
              { id: 'crm', title: 'CRM', visible: true, pages: [{ path: '/leads' }, { path: '/followups' }, { path: '/bookings' }] },
              { id: 'management', title: 'Management', visible: true, pages: [{ path: '/finance' }, { path: '/announcements' }, { path: '/ops-logs' }, { path: '/artists' }] },
              { id: 'admin', title: 'Admin', visible: true, pages: [{ path: '/admin/users' }, { path: '/admin' }, { path: '/admin/exly-campaigns' }, { path: '/admin/scripts' }, { path: '/admin/gamification' }, { path: '/admin/qa' }] }
            ];

            // Force inject new pages if missing from user's custom preferences
            const hasQA = rawGroups.some(g => g.pages?.some(p => p.path === '/admin/qa'));
            if (!hasQA) {
              const adminGroup = rawGroups.find(g => g.id === 'admin');
              if (adminGroup) {
                adminGroup.pages = [...(adminGroup.pages || []), { path: '/admin/qa', visible: true }];
              }
            }

            const hasSubscriptions = rawGroups.some((g) =>
              (g.pages || []).some((p) => normalizeNavPagePath(p.path) === '/subscriptions')
            );
            if (!hasSubscriptions) {
              const officeGroup = rawGroups.find((g) => g.id === 'office');
              if (officeGroup) {
                officeGroup.pages = [
                  ...(officeGroup.pages || []),
                  { path: '/subscriptions', label: 'Subscriptions', visible: true },
                ];
              }
            }

            return rawGroups.map((group) => ({
              ...group,
              pages: (group.pages || []).map((page) => ({
                ...page,
                path: normalizeNavPagePath(page.path),
              })),
            }));
          })()
            .filter(group => group.visible)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(group => {
              const visiblePages = (group.pages || [])
                .filter(page => (page.visible !== false) && PAGE_CONFIG[page.path] && hasPageAccess(user, PAGE_CONFIG[page.path].accessKey))
                .sort((a, b) => (a.order || 0) - (b.order || 0));

              if (visiblePages.length === 0) return null;

              return (
                <NavGroup key={group.id} title={group.title} collapsed={!showLabels} isMobile={isMobile}>
                  {visiblePages.map(page => {
                    const config = PAGE_CONFIG[page.path];
                    return (
                      <NavItem
                        key={page.path}
                        to={page.path}
                        icon={config.icon}
                        label={page.label || config.label}
                        collapsed={!showLabels}
                        isMobile={isMobile}
                        end={config.end}
                        count={
                          page.path === '/inbox' ? statusCounts.notifications?.unread :
                            page.path === '/followups' ? statusCounts.followups?.overdue : 0
                        }
                        todayCount={
                          page.path === '/calendar' ? statusCounts.calendar?.today : 0
                        }
                        onMouseEnter={() => {
                          if (page.path === '/dashboard') {
                            queryClient.prefetchQuery({ queryKey: ['logs', user?._id], queryFn: async () => (await axios.get(`/api/logs?userId=${user?._id}`)).data });
                          } else if (page.path === '/calendar') {
                            queryClient.prefetchQuery({ queryKey: ['calendar'], queryFn: async () => (await axios.get('/api/calendar')).data });
                          } else if (page.path === '/projects') {
                            queryClient.prefetchQuery({ queryKey: ['projects'], queryFn: async () => (await axios.get('/api/projects')).data });
                          } else if (page.path === '/assets') {
                            queryClient.prefetchQuery({ queryKey: ['assets'], queryFn: async () => (await axios.get('/api/assets')).data });
                          } else if (page.path === '/leads') {
                            queryClient.prefetchQuery({ queryKey: ['leads'], queryFn: async () => (await axios.get('/api/crm/leads')).data });
                          } else if (page.path === '/artists') {
                            queryClient.prefetchQuery({ queryKey: ['artists'], queryFn: async () => (await axios.get('/api/artists')).data });
                          } else if (page.path === '/admin/users') {
                            queryClient.prefetchQuery({ queryKey: ['userDirectory'], queryFn: async () => (await axios.get('/api/users/directory')).data.users });
                            queryClient.prefetchQuery({ queryKey: ['teams'], queryFn: async () => (await axios.get('/api/teams')).data });
                          }
                        }}
                      />
                    );
                  })}
                </NavGroup>
              );
            })}
        </nav>

        <div className="p-2 border-t border-[var(--color-bg-border)] space-y-1.5">
          {!(!showLabels && !isMobile) && (
            <div className="flex gap-1.5 w-full">
              <button
                onClick={() => navigate('/settings')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg hover:border-blue-500/50 transition-all group overflow-hidden"
                title="Settings"
              >
                <Settings size={16} className="text-[var(--color-text-secondary)] group-hover:text-blue-500 transition-colors" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                  Settings
                </span>
              </button>
              <button
                onClick={toggleTheme}
                className="px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg hover:border-blue-500/50 transition-all flex items-center justify-center shrink-0"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={16} className="text-yellow-500" /> : <Moon size={16} className="text-[var(--color-text-secondary)]" />}
              </button>
            </div>
          )}

          {(!showLabels && !isMobile) && (
            <div className="flex flex-col gap-1.5 w-full">
              <button
                onClick={() => navigate('/settings')}
                title="Settings"
                className="w-full flex items-center justify-center p-2 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] hover:border-blue-500/50 transition-colors"
              >
                <Settings size={16} className="text-[var(--color-text-secondary)] hover:text-blue-500 transition-colors" />
              </button>
              <button
                onClick={toggleTheme}
                title="Toggle Theme"
                className="w-full flex items-center justify-center p-2 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] hover:border-blue-500/50 transition-colors"
              >
                {theme === 'dark' ? <Sun size={16} className="text-yellow-500" /> : <Moon size={16} className="text-[var(--color-text-secondary)]" />}
              </button>
            </div>
          )}

          <div
            onClick={() => navigate('/settings')}
            className="w-full text-left group cursor-pointer"
            title={!showLabels ? user?.name : undefined}
          >
            <div className={`bg-[var(--color-bg-workspace)] rounded-lg border border-[var(--color-bg-border)] group-hover:border-blue-500/50 transition-all duration-300 overflow-hidden ${showLabels ? 'px-2.5 py-2' : 'p-1.5 flex justify-center'}`}>
              <div className={`flex items-center ${showLabels ? 'gap-2.5' : 'justify-center'}`}>
                <div className="relative shrink-0 group/avatar">
                  <div className={`rounded-lg bg-gray-200 overflow-hidden border border-[var(--color-bg-border)] z-10 relative ${showLabels ? 'w-8 h-8' : 'w-7 h-7'}`}>
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
                {showLabels && (
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-tight truncate group-hover:text-blue-500 transition-colors">{user.name}</p>
                    <p className="text-[8px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider truncate">{getDepartmentName(user)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default OutletSidebar;
