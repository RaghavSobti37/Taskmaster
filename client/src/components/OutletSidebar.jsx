import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useStatusCounts } from '../hooks/useStatusCounts';
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
  StickyNote,
  Mail,
  ClipboardCheck,
  ChevronDown,
  X,
  Moon,
  Sun,
  Settings,
  Monitor,
  UserPlus,
  Building2,
  CircleDollarSign,
  Shield,
} from 'lucide-react';
import { useSidebar, SIDEBAR_SHELL_WIDTH_COLLAPSED, SIDEBAR_SHELL_WIDTH_OPEN, SIDEBAR_MOBILE_SHELL_WIDTH } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';
import { hasPageAccess, hasAnyPageAccess, getDepartmentName, getDepartmentSlug } from '../utils/departmentPermissions';
import { useNavbarPreferences } from '../hooks/useNavbarPreferences';
import { useTheme } from '../contexts/ThemeContext';
import { useIsMobile } from '../hooks/useBreakpoint';
import { getNavCountsForPath, totalNavBadge } from '../utils/navStatusCounts';
import { DEFAULT_NAVBAR_GROUPS } from '../utils/navbarConfig';
import { canAccessNavPath, getManagementHubPath } from '../utils/navPageAccess';
import { isNavDesktopOnly } from '../utils/mobilePageSupport';
import { prefetchNavRoute } from '../lib/navPrefetch';
import CountBadge from './ui/CountBadge';
import BrandLogo from './brand/BrandLogo';
import { TOUR_ATTR_BY_PATH } from '../constants/onboardingSteps';

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
  '/assets': { icon: FolderArchive, label: 'Assets', accessKey: 'assets', end: false },
  '/schedule': { icon: CalendarClock, label: 'Schedule', accessKey: 'schedule' },
  '/logs': { icon: NotebookPen, label: 'Daily Logs', accessKey: 'logs' },
  '/notes': { icon: StickyNote, label: 'Notes', accessKey: 'notes' },
  '/emails': { icon: Mail, label: 'Emails', accessKey: 'emails' },
  '/attendance': { icon: ClipboardCheck, label: 'Attendance', accessKey: 'attendance' },
  '/crm': {
    icon: UserPlus,
    label: 'CRM',
    accessKey: 'crm_hub',
    matchPaths: ['/crm', '/leads', '/followups', '/bookings'],
  },
  '/office': {
    icon: Building2,
    label: 'People & Office',
    accessKey: 'office_hub',
    matchPaths: ['/office', '/equipment', '/contacts', '/subscriptions'],
  },
  '/management': {
    icon: CircleDollarSign,
    label: 'Management',
    accessKey: 'management_hub',
    matchPaths: ['/management', '/finance', '/announcements', '/ops-logs', '/artists'],
  },
  '/admin/console': {
    icon: Shield,
    label: 'Admin',
    accessKey: 'admin_console',
    matchPaths: ['/admin', '/admin/console', '/admin/users', '/admin/platform-settings', '/admin/teams', '/admin/roles', '/admin/artist-path', '/admin/exly-campaigns', '/admin/scripts', '/admin/gamification', '/admin/project-analytics', '/admin/qa', '/admin/control'],
    end: true,
  },
};

const canShowNavPage = (user, path) => {
  if (!PAGE_CONFIG[path]) return false;
  return canAccessNavPath(user, path, hasPageAccess, hasAnyPageAccess);
};

const NAV_ICON_TONES = {
  '/dashboard': { chip: 'rgba(148, 163, 184, 0.18)', icon: '#94a3b8' },
  '/projects': { chip: 'rgba(59, 130, 246, 0.18)', icon: '#60a5fa' },
  '/todo': { chip: 'rgba(34, 197, 94, 0.18)', icon: '#4ade80' },
  '/inbox': { chip: 'rgba(244, 63, 94, 0.16)', icon: '#fb7185' },
  '/attendance': { chip: 'rgba(245, 158, 11, 0.18)', icon: '#fbbf24' },
  '/calendar': { chip: 'rgba(168, 85, 247, 0.16)', icon: '#c084fc' },
  '/logs': { chip: 'rgba(249, 115, 22, 0.16)', icon: '#fb923c' },
  '/assets': { chip: 'rgba(6, 182, 212, 0.16)', icon: '#22d3ee' },
  '/schedule': { chip: 'rgba(99, 102, 241, 0.16)', icon: '#818cf8' },
  '/emails': { chip: 'rgba(14, 165, 233, 0.16)', icon: '#38bdf8' },
  '/crm': { chip: 'rgba(16, 185, 129, 0.16)', icon: '#34d399' },
  '/office': { chip: 'rgba(20, 184, 166, 0.16)', icon: '#2dd4bf' },
  '/management': { chip: 'rgba(234, 179, 8, 0.16)', icon: '#facc15' },
  '/admin/console': { chip: 'rgba(139, 92, 246, 0.16)', icon: '#a78bfa' },
};

const NavItem = ({ to, icon: Icon, label, count, todayCount, badgeCount, badgeVariant, collapsed, isMobile, onClick, onMouseEnter, end, matchPaths, desktopOnly, iconTone, tourId }) => {
  const displayBadge = badgeCount ?? totalNavBadge(count, todayCount);
  const pillVariant = badgeVariant ?? (count > 0 ? 'rose' : 'amber');
  const location = useLocation();
  const pathOnly = to.split('?')[0];
  const isHubMatch = (matchPaths || []).some((prefix) =>
    location.pathname === prefix || location.pathname.startsWith(`${prefix}/`)
  );
  const isExactMatch = end
    ? location.pathname === pathOnly && location.search === (to.includes('?') ? `?${to.split('?')[1]}` : '')
    : location.pathname.startsWith(pathOnly);
  const isActive = matchPaths?.length ? isHubMatch : isExactMatch;
  const iconOnly = collapsed && !isMobile;
  const tone = iconTone || NAV_ICON_TONES[pathOnly] || NAV_ICON_TONES['/dashboard'];
  const navTitle = iconOnly ? label : undefined;

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      title={navTitle}
      aria-label={navTitle || label}
      aria-current={isActive ? 'page' : undefined}
      data-tour={tourId || undefined}
      className={`tm-sidebar-nav-item ${iconOnly ? 'tm-sidebar-nav-item--icon-only' : ''} ${isActive ? 'is-active' : ''}`}
    >
      <div className="relative flex items-center justify-center shrink-0">
        <span
          className="tm-sidebar-icon-chip"
          style={{ backgroundColor: tone.chip, color: tone.icon }}
        >
          <Icon size={16} className="shrink-0" strokeWidth={2.1} />
        </span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse border-2 border-[var(--color-bg-surface)] shadow-[0_0_8px_rgba(244,63,94,0.5)] z-10" />
        )}
        {count === 0 && todayCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-[var(--color-bg-surface)] z-10" />
        )}
      </div>
      {(!collapsed || isMobile) && (
        <>
          <span className="tm-sidebar-nav-label min-w-0 flex-1 truncate">{label}</span>
          {displayBadge > 0 && (
            <CountBadge
              count={displayBadge}
              size="md"
              variant={pillVariant}
              pulse={pillVariant === 'rose'}
              className="!border-[var(--color-bg-surface)]"
            />
          )}
          {desktopOnly && (
            <span
              className="shrink-0 flex items-center justify-center w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400"
              title="Best on desktop"
            >
              <Monitor size={11} strokeWidth={2.5} />
            </span>
          )}
        </>
      )}
    </NavLink>
  );
};

const NavGroup = ({ title, icon: Icon, children, collapsed, isMobile, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const iconOnly = collapsed && !isMobile;
  return (
    <div className="flex flex-col mb-1.5 tm-sidebar-group-toggle">
      {!iconOnly && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title} section`}
          className="flex items-center justify-between px-1.5 py-1 mb-1 text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider hover:text-[var(--color-text-primary)] transition-colors focus:outline-none"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {Icon && <Icon size={12} />}
            <span className="truncate">{title}</span>
          </div>
          <ChevronDown size={12} className={`transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}
      {isOpen && (!collapsed || isMobile) ? (
        <div className="overflow-hidden flex flex-col gap-1">
          {children}
        </div>
      ) : iconOnly ? (
        <div className="flex flex-col gap-1">
          {children}
        </div>
      ) : null}
    </div>
  );
};

const OutletSidebar = () => {
  const { isOpen, toggleSidebar, isMobileOpen, closeMobileSidebar } = useSidebar();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const asideRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [shellQueriesReady, setShellQueriesReady] = useState(false);

  useEffect(() => {
    const enable = () => setShellQueriesReady(true);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(enable, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(enable, 500);
    return () => clearTimeout(timer);
  }, []);

  const shellQueriesEnabled = shellQueriesReady && !!user;
  const { data: navbarPreferences } = useNavbarPreferences(shellQueriesEnabled);
  const { data: statusCounts = {
    tasks: { overdue: 0, today: 0, inReview: 0 },
    followups: { overdue: 0, today: 0 },
    calendar: { today: 0 },
    notifications: { unread: 0, byCategory: {} },
    review: { pending: 0 },
  } } = useStatusCounts(shellQueriesEnabled);
  const isMobile = useIsMobile();
  const departmentSlug = getDepartmentSlug(user);

  useEffect(() => {
    closeMobileSidebar();
  }, [location, closeMobileSidebar]);

  useEffect(() => {
    if (!isMobileOpen || !isMobile) return undefined;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileSidebar({ returnFocus: true });
        return;
      }
      if (event.key !== 'Tab' || !asideRef.current) return;
      const focusable = asideRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, isMobile, closeMobileSidebar]);

  const navGroups = useMemo(() => {
    const rawGroups = navbarPreferences?.groups?.length
      ? navbarPreferences.groups
      : DEFAULT_NAVBAR_GROUPS;

    return rawGroups
      .map((group) => {
        const seen = new Set();
        const pages = (group.pages || [])
          .map((page) => ({
            ...page,
            path: normalizeNavPagePath(page.path),
          }))
          .filter((page) => {
            if (!page.path || seen.has(page.path)) return false;
            seen.add(page.path);
            return true;
          });
        return { ...group, pages };
      })
      .filter((group) => group.visible !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [navbarPreferences]);

  const showLabels = isMobile ? isMobileOpen : isOpen;

  const prefetchNavPage = (path) => prefetchNavRoute(path, user?._id, user);

  const renderNavPages = (pages) => pages
    .filter((page) => page.path !== '/chat' && page.visible !== false && canShowNavPage(user, page.path))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((page) => {
      const config = PAGE_CONFIG[page.path];
      const navCounts = getNavCountsForPath(page.path, statusCounts);
      const navPath = page.path === '/management'
        ? getManagementHubPath(user, hasPageAccess)
        : page.path;
      return (
        <NavItem
          key={page.path}
          to={navPath}
          icon={config.icon}
          label={page.label || config.label}
          iconTone={NAV_ICON_TONES[page.path]}
          collapsed={!showLabels}
          isMobile={isMobile}
          end={config.end}
          matchPaths={config.matchPaths}
          count={navCounts.count}
          todayCount={navCounts.todayCount}
          badgeCount={navCounts.badgeCount}
          badgeVariant={navCounts.badgeVariant}
          onClick={isMobile ? closeMobileSidebar : undefined}
          onMouseEnter={() => prefetchNavPage(page.path)}
          desktopOnly={isMobile && isNavDesktopOnly(page.path)}
          tourId={TOUR_ATTR_BY_PATH[page.path]}
        />
      );
    });

  const hubsDefaultOpen = ['sales', 'ops', 'operations', 'admin', 'artist-management', 'creative'].includes(departmentSlug);

  const shellWidth = isMobile
    ? SIDEBAR_MOBILE_SHELL_WIDTH
    : showLabels
      ? SIDEBAR_SHELL_WIDTH_OPEN
      : SIDEBAR_SHELL_WIDTH_COLLAPSED;

  const shellClassName = isMobile
    ? `fixed left-0 top-0 h-screen z-[70] tm-sidebar-shell transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-[216px]'}`
    : `fixed left-0 top-0 h-screen z-[70] tm-sidebar-shell transition-[width] duration-300 ease-in-out ${showLabels ? '' : 'tm-sidebar-shell--collapsed'}`;

  return (
    <>
      {isMobileOpen && (
        <div
          role="presentation"
          onClick={closeMobileSidebar}
          className="fixed inset-0 bg-slate-950/45 dark:bg-slate-950/55 backdrop-blur-sm z-[60] lg:hidden animate-in fade-in duration-200"
        />
      )}

      <aside
        ref={asideRef}
        aria-label="Main navigation"
        data-tour="sidebar-nav"
        className={shellClassName}
        style={{ width: shellWidth }}
      >
        <div className="tm-sidebar-panel">
        <div className={`tm-sidebar-header flex items-center overflow-hidden ${showLabels ? 'px-3 py-3 justify-between' : 'px-2 py-2 justify-center flex-col gap-2'}`}>
          <div className={`flex items-center min-w-0 ${showLabels ? 'gap-2.5' : ''}`}>
            <BrandLogo size={28} className="shrink-0" />
            {showLabels && (
              <span className="font-semibold text-[13px] tracking-tight text-[var(--color-text-primary)] truncate">
                Coreknot
              </span>
            )}
          </div>

          <div className={`flex items-center shrink-0 ${showLabels ? 'gap-1' : 'flex-col gap-1'}`}>
            {!isMobile && (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                className="tm-sidebar-control p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {isOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
              </button>
            )}
            {isMobileOpen && (
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => closeMobileSidebar({ returnFocus: true })}
                aria-label="Close navigation menu"
                className="lg:hidden tm-sidebar-control p-1.5 text-[var(--color-text-muted)] transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto custom-scrollbar min-h-0" aria-label="Application pages">
          {navGroups.map((group) => {
            const visiblePages = (group.pages || [])
              .filter((page) => page.path !== '/chat' && page.visible !== false && canShowNavPage(user, page.path));

            if (visiblePages.length === 0) return null;

            if (group.flat || group.id === 'primary') {
              return (
                <div key={group.id} className="flex flex-col gap-1 mb-1.5" aria-label={group.title}>
                  {renderNavPages(visiblePages)}
                </div>
              );
            }

            const defaultOpen = group.defaultOpen ?? (group.id === 'hubs' ? hubsDefaultOpen : true);
            return (
              <NavGroup
                key={group.id}
                title={group.title}
                collapsed={!showLabels}
                isMobile={isMobile}
                defaultOpen={defaultOpen}
              >
                {renderNavPages(visiblePages)}
              </NavGroup>
            );
          })}
        </nav>

        <div className="p-2 space-y-1.5">
          {!(!showLabels && !isMobile) && (
            <div className="flex gap-1.5 w-full">
              <button
                type="button"
                onClick={() => navigate('/settings')}
                aria-label="Settings"
                data-tour="sidebar-settings"
                className="tm-sidebar-control flex-1 flex items-center justify-center gap-2 px-3 py-2 transition-all group overflow-hidden"
                title="Settings"
              >
                <Settings size={15} className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-action-primary)] transition-colors" />
                <span className="text-[10px] font-semibold tracking-wide text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                  Settings
                </span>
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                className="tm-sidebar-control px-3 py-2 transition-all flex items-center justify-center shrink-0"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={15} className="text-yellow-500" /> : <Moon size={15} className="text-[var(--color-text-secondary)]" />}
              </button>
            </div>
          )}

          {(!showLabels && !isMobile) && (
            <div className="flex flex-col gap-1.5 w-full">
              <button
                type="button"
                onClick={() => navigate('/settings')}
                aria-label="Settings"
                data-tour="sidebar-settings"
                title="Settings"
                className="w-full tm-sidebar-control flex items-center justify-center p-2 transition-colors"
              >
                <Settings size={15} className="text-[var(--color-text-secondary)] hover:text-[var(--color-action-primary)] transition-colors" />
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                title="Toggle Theme"
                className="w-full tm-sidebar-control flex items-center justify-center p-2 transition-colors"
              >
                {theme === 'dark' ? <Sun size={15} className="text-yellow-500" /> : <Moon size={15} className="text-[var(--color-text-secondary)]" />}
              </button>
            </div>
          )}

          <div
            onClick={() => navigate('/settings')}
            data-tour="sidebar-profile"
            className="w-full text-left group cursor-pointer"
            title={!showLabels ? user?.name : undefined}
          >
            <div className={`tm-sidebar-footer-card group-hover:border-[var(--color-action-primary)]/35 transition-all duration-300 overflow-hidden ${showLabels ? 'px-2.5 py-2' : 'p-1.5 flex justify-center'}`}>
              <div className={`flex items-center ${showLabels ? 'gap-2.5' : 'justify-center'}`}>
                <div className="relative shrink-0 group/avatar">
                  <div className={`rounded-lg bg-gray-200 overflow-hidden border border-[var(--color-bg-border)] z-10 relative ${showLabels ? 'w-8 h-8' : 'w-7 h-7'}`}>
                    {user?.avatar ? <img src={user.avatar} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold">{user?.name?.[0]}</div>}
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
                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-[8px] font-bold rounded opacity-0 group-hover/avatar:opacity-100 pointer-events-none whitespace-nowrap z-30 transition-opacity">
                        Level {user.level} • {user.exp} / {Math.floor(100 * Math.pow(user.level, 1.5))} XP
                      </div>
                    </>
                  )}
                </div>
                {showLabels && (
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-tight truncate group-hover:text-[var(--color-action-primary)] transition-colors">{user.name}</p>
                    <p className="text-[8px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider truncate">{getDepartmentName(user)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      </aside>
    </>
  );
};

export default OutletSidebar;
