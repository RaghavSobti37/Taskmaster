import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';

const NavItem = ({ to, icon: Icon, label, collapsed, onClick }) => (
  <NavLink 
    to={to} 
    onClick={onClick}
    className={({ isActive }) => `
      flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
      ${isActive 
        ? 'bg-[var(--color-action-primary)] text-white shadow-lg shadow-blue-500/20' 
        : 'hover:bg-[var(--color-bg-border)] text-[var(--color-text-secondary)]'}
    `}
  >
    <Icon size={22} className="shrink-0" />
    {(!collapsed || window.innerWidth < 768) && (
      <span className="font-medium whitespace-nowrap">{label}</span>
    )}
  </NavLink>
);

const OutletSidebar = () => {
  const { isOpen, toggleSidebar, isMobileOpen, closeMobileSidebar } = useSidebar();
  const { logout, user } = useAuth();
  const location = useLocation();

  // Close mobile sidebar on route change
  useEffect(() => {
    closeMobileSidebar();
  }, [location]);

  const sidebarVariants = {
    open: { x: 0, width: 256 },
    collapsed: { x: 0, width: 80 },
    mobileOpen: { x: 0, width: 280 },
    mobileClosed: { x: -300, width: 280 }
  };

  return (
    <>
      {/* Mobile Overlay */}
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
          window.innerWidth < 1024 
            ? (isMobileOpen ? "mobileOpen" : "mobileClosed")
            : (isOpen ? "open" : "collapsed")
        }
        variants={sidebarVariants}
        className={`fixed left-0 top-0 h-screen bg-[var(--color-bg-surface)] border-r border-[var(--color-bg-border)] z-[70] flex flex-col shadow-2xl shadow-black/5 transition-[width,transform] duration-300 ease-in-out`}
      >
        {/* Header */}
        <div className="p-5 flex items-center justify-between">
          {(isOpen || isMobileOpen) ? (
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
          
          {/* Desktop Toggle */}
          {isOpen && !isMobileOpen && (
            <button 
              onClick={toggleSidebar}
              className="hidden lg:flex p-1.5 hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-muted)] transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {/* Mobile Close */}
          {isMobileOpen && (
            <button 
              onClick={closeMobileSidebar}
              className="lg:hidden p-1.5 hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-muted)] transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Desktop Expand Toggle (Collapsed state) */}
        {!isOpen && !isMobileOpen && (
          <button 
            onClick={toggleSidebar}
            className="hidden lg:flex mx-auto my-2 p-1.5 hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-muted)] transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 mt-4 space-y-2 overflow-y-auto custom-scrollbar">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" collapsed={!isOpen} />
          <NavItem to="/projects" icon={Briefcase} label="Projects" collapsed={!isOpen} />
          <NavItem to="/team" icon={Users} label="Team" collapsed={!isOpen} />
          <NavItem to="/assets" icon={Layers} label="Assets" collapsed={!isOpen} />
          <NavItem to="/calendar" icon={Calendar} label="Calendar" collapsed={!isOpen} />
          <NavItem to="/logs" icon={ListTodo} label="Daily Logs" collapsed={!isOpen} />
          {(user?.role === 'admin' || user?.role === 'sales') && (
            <NavItem to="/crm" icon={Database} label="CRM" collapsed={!isOpen} />
          )}
          
          {user?.role === 'admin' && (
            <>
              <div className="pt-4 pb-2 px-3">
                {!isOpen && !isMobileOpen ? (
                  <div className="h-px bg-[var(--color-bg-border)]" />
                ) : (
                  <p className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest">Admin</p>
                )}
              </div>
              <NavItem to="/admin" icon={ShieldCheck} label="Admin Panel" collapsed={!isOpen} />
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--color-bg-border)] space-y-1">
          {(isOpen || isMobileOpen) && (
            <div className="px-3 py-3 mb-2 bg-[var(--color-bg-workspace)] rounded-2xl border border-[var(--color-bg-border)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-200 overflow-hidden border border-[var(--color-bg-border)]">
                  {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold">{user?.name?.[0]}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">{user?.name}</p>
                  <div className="flex items-center gap-1.5 text-[9px] text-green-500 font-bold uppercase tracking-widest">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    Online
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
            {(isOpen || isMobileOpen) && <span className="font-bold text-sm">Log Out</span>}
          </button>
        </div>
      </motion.aside>
    </>
  );
};

export default OutletSidebar;
