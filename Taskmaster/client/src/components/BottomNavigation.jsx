import React, { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ListTodo, Inbox, Plus } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useStatusCounts } from '../hooks/useTaskmasterQueries';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import { useQuickAdd } from '../contexts/quickAddContextCore';
import QuickAddActionPanel from './QuickAddActionPanel';
import { UserAvatar } from './ui/UserAvatar';
import { getNavCountsForPath } from '../utils/navStatusCounts';
import MobileProfileMenu from './mobile/MobileProfileMenu';
import { prefetchNavRoute } from '../lib/navPrefetch';

const NAV_FLOAT_BOTTOM = 'max(0.75rem, env(safe-area-inset-bottom))';
const QUICK_ADD_BOTTOM = `calc(5rem + ${NAV_FLOAT_BOTTOM})`;

/** Route/profile icons — bumped above legacy 22px; bar chrome is ~9% tighter than original. */
const NAV_ICON_SIZE = 25;
const NAV_ADD_PLUS_SIZE = 22;

const NAV_SLOTS = [
  {
    key: 'home',
    type: 'route',
    to: '/dashboard',
    icon: LayoutDashboard,
    label: 'Home',
    tourId: 'nav-home',
    match: (path) => path === '/dashboard' || path === '/',
  },
  {
    key: 'tasks',
    type: 'route',
    to: '/todo',
    icon: ListTodo,
    label: 'Tasks',
    tourId: 'nav-tasks',
    match: (path) => path.startsWith('/todo'),
  },
  { key: 'add', type: 'action', action: 'add', icon: Plus, label: 'Add', tourId: 'nav-add' },
  {
    key: 'inbox',
    type: 'route',
    to: '/inbox',
    icon: Inbox,
    label: 'Inbox',
    tourId: 'nav-inbox',
    match: (path) => path.startsWith('/inbox'),
  },
  { key: 'you', type: 'action', action: 'profile', label: 'You', tourId: 'nav-profile' },
];

function resolveRouteSlotIndex(pathname) {
  const idx = NAV_SLOTS.findIndex((slot) => slot.type === 'route' && slot.match?.(pathname));
  return idx >= 0 ? idx : 0;
}

function NavBadge({ count }) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  const label = n > 99 ? '99+' : String(n);
  return (
    <span className="absolute -top-0.5 -right-2 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#25D366] px-0.5 text-[8px] font-bold leading-none text-white ring-2 ring-[#1a1a1a]">
      {label}
    </span>
  );
}

function BottomNavSlot({
  slot,
  slotRef,
  badge,
  user,
  isHighlighted,
  addOpen,
  onSelect,
  onPointerEnter,
}) {
  const Icon = slot.icon;
  const isAdd = slot.action === 'add';

  return (
    <button
      ref={slotRef}
      type="button"
      onClick={onSelect}
      onPointerEnter={onPointerEnter}
      data-tour={slot.tourId || undefined}
      className="relative z-[1] flex flex-1 min-w-0 justify-center touch-manipulation"
      aria-label={slot.label}
      aria-current={slot.type === 'route' && isHighlighted ? 'page' : undefined}
      aria-expanded={isAdd ? addOpen : undefined}
    >
      <span
        className={`relative flex min-h-[44px] min-w-[51px] flex-col items-center justify-center gap-0.5 rounded-full px-3 py-[5px] transition-colors ${
          isHighlighted ? 'text-white' : 'text-white/70 hover:text-white'
        }`}
      >
        {isHighlighted && (
          <motion.span
            layoutId="bottom-nav-active-pill"
            className="absolute -left-[7px] -right-[7px] -top-[5px] -bottom-[5px] rounded-full bg-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          />
        )}
        {isAdd ? (
          <span
            className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#126d5e] text-white shadow-md transition-transform ${
              addOpen ? 'rotate-45' : ''
            }`}
          >
            <Plus size={NAV_ADD_PLUS_SIZE} strokeWidth={2.5} />
          </span>
        ) : slot.action === 'profile' ? (
          <UserAvatar
            user={user}
            size="xs"
            className="relative pointer-events-none !h-[25px] !w-[25px] !text-[9px] ring-2 ring-white/20"
          />
        ) : (
          <span className="relative flex h-[25px] w-[25px] items-center justify-center">
            <Icon size={NAV_ICON_SIZE} strokeWidth={isHighlighted ? 2.25 : 1.75} />
            <NavBadge count={badge} />
          </span>
        )}
        <span className={`relative max-w-full truncate px-0.5 text-[10px] font-medium tracking-wide ${isHighlighted ? 'text-white' : 'text-white/80'}`}>
          {slot.label}
        </span>
      </span>
    </button>
  );
}

const BottomNavigation = () => {
  const [profileOpen, setProfileOpen] = useState(false);
  const { mobileMenuTriggerRef } = useSidebar();
  const { open: addOpen, toggleMenu: toggleAddMenu, closeMenu: closeAddMenu } = useQuickAdd();
  const { user } = useAuth();
  const { data: statusCounts = {} } = useStatusCounts(!!user);
  const location = useLocation();
  const navigate = useNavigate();

  const todoCounts = getNavCountsForPath('/todo', statusCounts);
  const inboxCounts = getNavCountsForPath('/inbox', statusCounts);

  const badgesByKey = {
    home: 0,
    tasks: todoCounts.badgeCount ?? todoCounts.count + todoCounts.todayCount,
    inbox: inboxCounts.count,
  };

  const activeSlotIndex = profileOpen
    ? 4
    : addOpen
      ? 2
      : resolveRouteSlotIndex(location.pathname);

  const goToTab = useCallback(
    (to) => {
      closeAddMenu();
      setProfileOpen(false);
      if (location.pathname !== to) navigate(to);
    },
    [closeAddMenu, location.pathname, navigate]
  );

  const handleSlotSelect = useCallback(
    (index) => {
      const slot = NAV_SLOTS[index];
      if (!slot) return;

      if (slot.type === 'route') {
        goToTab(slot.to);
        return;
      }

      if (slot.action === 'add') {
        setProfileOpen(false);
        toggleAddMenu();
        return;
      }

      if (slot.action === 'profile') {
        closeAddMenu();
        setProfileOpen(true);
      }
    },
    [closeAddMenu, goToTab, toggleAddMenu]
  );

  return (
    <>
      <AnimatePresence>
        {addOpen && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[54] bg-black/30 lg:hidden"
            aria-label="Close add menu"
            onClick={closeAddMenu}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed left-1/2 z-[56] w-[min(92vw,16rem)] -translate-x-1/2 lg:hidden"
            style={{ bottom: QUICK_ADD_BOTTOM }}
          >
            <QuickAddActionPanel align="center" />
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        className="fixed left-3 right-3 z-[55] mx-auto max-w-lg lg:hidden"
        style={{ bottom: NAV_FLOAT_BOTTOM }}
        aria-label="Primary"
        data-tour="bottom-nav"
      >
        <div className="rounded-full border border-white/10 bg-[#1a1a1a]/95 px-1.5 py-[5px] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <LayoutGroup id="bottom-nav">
            <div className="flex items-center justify-around">
              {NAV_SLOTS.map((slot, index) => (
                <BottomNavSlot
                  key={slot.key}
                  slot={slot}
                  slotRef={slot.key === 'you' ? mobileMenuTriggerRef : undefined}
                  badge={badgesByKey[slot.key]}
                  user={user}
                  isHighlighted={activeSlotIndex === index}
                  addOpen={addOpen}
                  onSelect={() => handleSlotSelect(index)}
                  onPointerEnter={
                    slot.type === 'route'
                      ? () => prefetchNavRoute(slot.to, user?._id, user)
                      : undefined
                  }
                />
              ))}
            </div>
          </LayoutGroup>
        </div>
      </nav>

      <MobileProfileMenu open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
};

export default BottomNavigation;
