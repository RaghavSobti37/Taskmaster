import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Inbox, ListTodo } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { useStatusCounts } from '../hooks/useTaskmasterQueries';
import { useAuth } from '../contexts/AuthContext';
import { UserAvatar } from './ui/UserAvatar';

const BottomNavigation = () => {
  const { toggleMobileSidebar } = useSidebar();
  const { user } = useAuth();
  const { data: statusCounts = { notifications: { unread: 0 }, tasks: { overdue: 0 } } } = useStatusCounts(!!user);

  const taskBadge = (statusCounts.tasks?.overdue || 0) + (statusCounts.tasks?.today || 0);

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/todo', icon: ListTodo, label: 'Tasks', badge: taskBadge },
    { to: '/projects', icon: Briefcase, label: 'Projects' },
    { to: '/inbox', icon: Inbox, label: 'Inbox', badge: statusCounts.notifications?.unread },
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
                    <span className="absolute -top-1 -right-2 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white border-2 border-[var(--color-bg-primary)]">
                      {item.badge > 99 ? '99+' : item.badge}
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
