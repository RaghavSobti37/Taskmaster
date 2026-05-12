import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  ShieldCheck,
  Calendar,
  Users
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';

const NavItem = ({ to, icon: Icon, label, collapsed }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `
      flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
      ${isActive 
        ? 'bg-[var(--color-action-primary)] text-white shadow-lg shadow-blue-500/20' 
        : 'hover:bg-[var(--color-bg-border)] text-[var(--color-text-secondary)]'}
    `}
  >
    <Icon size={22} className="shrink-0" />
    {!collapsed && <span className="font-medium whitespace-nowrap">{label}</span>}
  </NavLink>
);

const OutletSidebar = () => {
  const { isOpen, toggleSidebar, activeWorkspace } = useSidebar();
  const { logout, user } = useAuth();

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isOpen ? 256 : 80 }}
      className="fixed left-0 top-0 h-screen bg-[var(--color-bg-surface)] border-r border-[var(--color-bg-border)] z-50 flex flex-col"
    >
      {/* Header */}
      <div className="p-5 flex items-center justify-between">
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 bg-[var(--color-action-primary)] rounded-lg flex items-center justify-center text-white font-bold">
              CK
            </div>
            <span className="font-bold text-xl tracking-tight text-[var(--color-text-primary)]">CoreKnot</span>
          </motion.div>
        )}
        <button 
          onClick={toggleSidebar}
          className="p-1.5 hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-muted)] transition-colors"
        >
          {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      {/* Workspace Switcher Placeholder */}
      {isOpen && (
        <div className="px-5 mb-6">
          <div className="p-3 bg-[var(--color-bg-workspace)] rounded-xl border border-[var(--color-bg-border)] flex items-center gap-3">
            <div className="w-6 h-6 bg-purple-500 rounded-md shrink-0" />
            <div className="overflow-hidden">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Active Workspace</p>
              <p className="text-sm font-semibold truncate text-[var(--color-text-primary)]">{activeWorkspace}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-2 overflow-y-auto">
        <NavItem to="/" icon={LayoutDashboard} label="Dashboard" collapsed={!isOpen} />
        <NavItem to="/projects" icon={Briefcase} label="Projects" collapsed={!isOpen} />
        <NavItem to="/team" icon={Users} label="Team" collapsed={!isOpen} />
        <NavItem to="/calendar" icon={Calendar} label="Calendar" collapsed={!isOpen} />
        
        {user?.role === 'admin' && (
          <>
            <div className="pt-4 pb-2 px-3">
              {!isOpen ? <div className="h-px bg-[var(--color-bg-border)]" /> : <p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Admin</p>}
            </div>
            <NavItem to="/admin" icon={ShieldCheck} label="System Desk" collapsed={!isOpen} />
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--color-bg-border)]">
        <NavItem to="/settings" icon={Settings} label="Settings" collapsed={!isOpen} />
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 mt-2 rounded-xl text-red-500 hover:bg-red-50 transition-all duration-200"
        >
          <LogOut size={22} className="shrink-0" />
          {isOpen && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </motion.aside>
  );
};

export default OutletSidebar;
