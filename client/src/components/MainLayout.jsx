import React from 'react';
import { Outlet } from 'react-router-dom';
import OutletSidebar from './OutletSidebar';
import { useSidebar } from '../contexts/SidebarContext';
import { requestNotificationPermission } from '../utils/notifications';
import { Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationTray from './NotificationTray';

const MainLayout = () => {
  const { isOpen, toggleMobileSidebar } = useSidebar();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const profileMenuRef = React.useRef(null);

  React.useEffect(() => {
    requestNotificationPermission();
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-workspace)]">
      {/* Sidebar Navigation */}
      <OutletSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[180px]">
        {/* Top Header (Desktop & Mobile) */}
        <header className="h-16 flex items-center justify-between px-6 bg-[var(--color-bg-surface)]/80 backdrop-blur-md border-b border-[var(--color-bg-border)] sticky top-0 z-40">
          <div className="flex items-center gap-3 lg:hidden">
            <button 
              onClick={toggleMobileSidebar}
              className="p-2 hover:bg-[var(--color-bg-workspace)] rounded-xl text-[var(--color-text-secondary)] transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="w-8 h-8 bg-[var(--color-action-primary)] rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              CK
            </div>
          </div>
          
          <div className="hidden lg:block">
            {/* Breadcrumbs or Page Title could go here */}
          </div>
          
          <div className="flex items-center gap-4">
            <NotificationTray />
            
            <div className="relative" ref={profileMenuRef}>
              <button 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="w-10 h-10 rounded-xl bg-gray-200 overflow-hidden border border-[var(--color-bg-border)] active:scale-95 transition-transform shadow-sm"
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-black uppercase bg-[var(--color-bg-workspace)]">
                    {user?.name?.[0]}
                  </div>
                )}
              </button>

              <AnimatePresence>
                {isProfileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-48 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl shadow-2xl overflow-hidden z-50 p-1.5"
                  >
                    <div className="px-4 py-3 mb-1 border-b border-[var(--color-bg-border)]">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-primary)] truncate">{user.name}</p>
                      <p className="text-[8px] font-bold text-[var(--color-text-secondary)] uppercase">{user.role}</p>
                    </div>
                    <Link
                      to="/settings"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-workspace)] hover:text-[var(--color-text-primary)] transition-all"
                    >
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/5 transition-all"
                    >
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main 
          className="flex-1 p-6 lg:p-8"
        >
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
