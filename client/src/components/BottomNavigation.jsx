import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Inbox, ListTodo } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { useStatusCounts } from '../hooks/useTaskmasterQueries';
import { useAuth } from '../contexts/AuthContext';
import { UserAvatar } from './ui/UserAvatar';
import CountBadge from './ui/CountBadge';
import { getNavCountsForPath } from '../utils/navStatusCounts';

const BottomNavigation = () => {
  const { toggleMobileSidebar } = useSidebar();
  const { user } = useAuth();
  const { data: statusCounts = {} } = useStatusCounts(!!user);
  const todoCounts = getNavCountsForPath('/todo', statusCounts);
  const inboxCounts = getNavCountsForPath('/inbox', statusCounts);
  const projectsCounts = getNavCountsForPath('/projects', statusCounts);

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    {
      to: '/todo',
      icon: ListTodo,
      label: 'Tasks',
      badge: todoCounts.badgeCount ?? todoCounts.count + todoCounts.todayCount,
      badgeVariant: todoCounts.badgeVariant ?? (todoCounts.count > 0 ? 'rose' : 'amber'),
    },
    {
      to: '/projects',
      icon: Briefcase,
      label: 'Projects',
      badge: projectsCounts.count,
      badgeVariant: 'warning',
    },
    {
      to: '/inbox',
      icon: Inbox,
      label: 'Inbox',
      badge: inboxCounts.count,
      badgeVariant: 'rose',
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-bg-primary)] border-t border-[var(--color-bg-border)] lg:hidden pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full min-w-0 space-y-0.5 transition-colors ${
                isActive ? 'text-[var(--color-action-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <item.icon size={22} className={isActive ? 'stroke-2' : 'stroke-[1.5]'} />
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-2">
                      <CountBadge
                        count={item.badge}
                        size="sm"
                        variant={item.badgeVariant || 'rose'}
                        pulse={item.badgeVariant === 'rose'}
                        className="!border-[var(--color-bg-primary)]"
                      />
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold tracking-wide truncate max-w-full px-0.5 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={toggleMobileSidebar}
          className="flex flex-col items-center justify-center flex-1 h-full min-w-0 space-y-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus:outline-none"
          aria-label="Open menu"
        >
          <UserAvatar
            user={user}
            size="xs"
            className="!w-[22px] !h-[22px] !text-[9px] ring-2 ring-transparent"
          />
          <span className="text-[10px] font-semibold tracking-wide opacity-70">More</span>
        </button>
      </div>
    </div>
  );
};

export default BottomNavigation;
