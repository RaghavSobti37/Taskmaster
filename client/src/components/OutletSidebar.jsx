import React, { useState } from 'react';
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
  Users,
  Plus,
  ChevronDown,
  Layers,
  Circle,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [wsOpen, setWsOpen] = useState(false);

  const workspaces = ['Main Hub', 'Marketing', 'Development', 'Strategy'];

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isOpen ? 256 : 80 }}
      className="fixed left-0 top-0 h-screen bg-[var(--color-bg-surface)] border-r border-[var(--color-bg-border)] z-50 flex flex-col shadow-2xl shadow-black/5"
    >
      {/* Header */}
      <div className="p-5 flex items-center justify-between">
        {isOpen ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 bg-[var(--color-action-primary)] rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              CK
            </div>
            <span className="font-bold text-xl tracking-tight text-[var(--color-text-primary)]">CoreKnot</span>
          </motion.div>
        ) : (
          <div className="w-8 h-8 mx-auto bg-[var(--color-action-primary)] rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
            CK
          </div>
        )}
        {isOpen && (
          <button 
            onClick={toggleSidebar}
            className="p-1.5 hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-muted)] transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        )}
      </div>

      {!isOpen && (
        <button 
          onClick={toggleSidebar}
          className="mx-auto my-2 p-1.5 hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-muted)] transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      )}



      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-2 overflow-y-auto">
        <NavItem to="/" icon={LayoutDashboard} label="Dashboard" collapsed={!isOpen} />
        <NavItem to="/projects" icon={Briefcase} label="Projects" collapsed={!isOpen} />
        <NavItem to="/team" icon={Users} label="Team" collapsed={!isOpen} />
        <NavItem to="/chat" icon={MessageSquare} label="Chat" collapsed={!isOpen} />
        <NavItem to="/calendar" icon={Calendar} label="Calendar" collapsed={!isOpen} />
        
        {user?.role === 'admin' && (
          <>
            <div className="pt-4 pb-2 px-3">
              {!isOpen ? <div className="h-px bg-[var(--color-bg-border)]" /> : <p className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest">Command</p>}
            </div>
            <NavItem to="/admin" icon={ShieldCheck} label="System Deck" collapsed={!isOpen} />
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--color-bg-border)] space-y-1">
        {isOpen && (
          <div className="px-3 py-3 mb-2 bg-[var(--color-bg-workspace)] rounded-2xl border border-[var(--color-bg-border)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-200 overflow-hidden border border-[var(--color-bg-border)]">
                {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold">{user?.name?.[0]}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">{user?.name}</p>
                <div className="flex items-center gap-1.5 text-[9px] text-green-500 font-bold uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  Authorized
                </div>
              </div>
            </div>
          </div>
        )}
        <NavItem to="/settings" icon={Settings} label="Settings" collapsed={!isOpen} />
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut size={22} className="shrink-0" />
          {isOpen && <span className="font-bold text-sm">Terminate Session</span>}
        </button>
      </div>
    </motion.aside>
  );
};

export default OutletSidebar;
