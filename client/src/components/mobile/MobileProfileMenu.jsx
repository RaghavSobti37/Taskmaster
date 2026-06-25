import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Settings,
  Briefcase,
  ClipboardCheck,
  CalendarDays,
  NotebookPen,
  FolderArchive,
  CalendarClock,
  Mail,
  StickyNote,
  UserPlus,
  Building2,
  CircleDollarSign,
  Shield,
  Sun,
  Moon,
  LayoutGrid,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { hasPageAccess, hasAnyPageAccess, getDepartmentName } from '../../utils/departmentPermissions';
import { canAccessNavPath, getManagementHubPath } from '../../utils/navPageAccess';
import { isNavDesktopOnly } from '../../utils/mobilePageSupport';
import { UserAvatar } from '../ui/UserAvatar';

const BOTTOM_NAV_PATHS = new Set(['/dashboard', '/todo', '/inbox']);

const MENU_SECTIONS = [
  {
    title: 'Account',
    items: [
      { path: '/settings', label: 'Settings & profile', icon: Settings },
      { path: '/projects', label: 'Projects', icon: Briefcase },
      { path: '/attendance', label: 'Attendance', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Tools',
    items: [
      { path: '/calendar', label: 'Calendar', icon: CalendarDays },
      { path: '/logs', label: 'Daily Logs', icon: NotebookPen },
      { path: '/assets', label: 'Assets', icon: FolderArchive },
      { path: '/schedule', label: 'Schedule', icon: CalendarClock },
      { path: '/emails', label: 'Emails', icon: Mail },
      { path: '/notes', label: 'Notes', icon: StickyNote },
    ],
  },
  {
    title: 'Modules',
    items: [
      { path: '/crm', label: 'CRM', icon: UserPlus },
      { path: '/office', label: 'People & Office', icon: Building2 },
      { path: '/management', label: 'Management', icon: CircleDollarSign },
      { path: '/admin/console', label: 'Admin', icon: Shield },
    ],
  },
];

function MenuRow({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left rounded-xl hover:bg-[var(--color-bg-secondary)] active:bg-[var(--color-bg-secondary)] transition-colors"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] text-[var(--color-action-primary)]">
        <Icon size={17} strokeWidth={2} />
      </span>
      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</span>
    </button>
  );
}

export default function MobileProfileMenu({ open, onClose }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toggleMobileSidebar } = useSidebar();

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('mobile-scroll-lock');
    return () => {
      document.body.classList.remove('mobile-scroll-lock');
    };
  }, [open]);

  const sections = useMemo(() => {
    return MENU_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (BOTTOM_NAV_PATHS.has(item.path)) return false;
        if (isNavDesktopOnly(item.path)) return false;
        return canAccessNavPath(user, item.path, hasPageAccess, hasAnyPageAccess);
      }),
    })).filter((section) => section.items.length > 0);
  }, [user]);

  const goTo = (path) => {
    onClose();
    navigate(path === '/management' ? getManagementHubPath(user, hasPageAccess) : path);
  };

  const openFullNav = () => {
    onClose();
    toggleMobileSidebar();
  };

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/login');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[99998] lg:hidden"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[99999] lg:hidden bg-[var(--color-bg-surface)] border-t border-[var(--color-bg-border)] rounded-t-2xl shadow-2xl max-h-[min(88vh,720px)] flex flex-col pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
            role="dialog"
            aria-modal="true"
            aria-label="Profile menu"
          >
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[var(--color-bg-border)]" aria-hidden />
            </div>

            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[var(--color-bg-border)] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar user={user} size="lg" className="!w-12 !h-12 !text-sm" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">{user?.name || 'Account'}</p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                    {getDepartmentName(user) || user?.email || 'Team member'}
                  </p>
                  {user?.level ? (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-action-primary)] mt-0.5">
                      Level {user.level}
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                aria-label="Close profile menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar px-2 py-2 space-y-3">
              {sections.map((section) => (
                <div key={section.title}>
                  <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {section.title}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {section.items.map((item) => (
                      <MenuRow
                        key={item.path}
                        icon={item.icon}
                        label={item.label}
                        onClick={() => goTo(item.path)}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  More
                </p>
                <div className="flex flex-col gap-0.5">
                  <MenuRow
                    icon={theme === 'dark' ? Sun : Moon}
                    label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                    onClick={toggleTheme}
                  />
                  <MenuRow icon={LayoutGrid} label="Browse all navigation" onClick={openFullNav} />
                  <MenuRow icon={LogOut} label="Log out" onClick={handleLogout} />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
