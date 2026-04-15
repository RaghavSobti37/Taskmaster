import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useKeyboardShortcut } from '../hooks/useCustomHooks';

interface NavbarRefactoredProps {
  onSearchClick?: () => void;
  onCreateTask?: () => void;
}

const NavbarRefactored: React.FC<NavbarRefactoredProps> = ({ onSearchClick, onCreateTask }) => {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Listen for keyboard shortcuts
  useKeyboardShortcut('k', true, () => {
    onSearchClick?.();
  });

  useKeyboardShortcut('n', true, () => {
    onCreateTask?.();
  });

  const navVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 100, damping: 20 }
    }
  };

  const dropdownVariants = {
    hidden: { opacity: 0, scale: 0.95, y: -10 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 200, damping: 15 }
    },
    exit: { opacity: 0, scale: 0.95, y: -10 }
  };

  return (
    <motion.nav
      initial="hidden"
      animate="visible"
      variants={navVariants}
      className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl"
    >
      <div className="container-max flex items-center justify-between h-16">
        {/* Logo/Brand */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-3 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center">
            <span className="text-white font-black text-lg">✓</span>
          </div>
          <h1 className="text-xl font-black tracking-tight hidden sm:block text-gray-950 dark:text-white">
            Task Master
          </h1>
        </motion.div>

        {/* Center - Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          <motion.a
            href="/dashboard"
            whileHover={{ color: '#b74b02' }}
            className="text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 transition-colors hover:text-primary-600"
          >
            Dashboard
          </motion.a>
          <motion.a
            href="/daily-log"
            whileHover={{ color: '#b74b02' }}
            className="text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 transition-colors hover:text-primary-600"
          >
            Daily Log
          </motion.a>
          <motion.a
            href="/projects"
            whileHover={{ color: '#b74b02' }}
            className="text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 transition-colors hover:text-primary-600"
          >
            Projects
          </motion.a>
        </div>

        {/* Right Side - Actions & Profile */}
        <div className="flex items-center gap-4">
          {/* Search Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSearchClick}
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Search - Press ⌘K"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">⌘K</span>
          </motion.button>

          {/* Create Task Button */}
          <motion.button
            onClick={onCreateTask}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="hidden sm:inline-flex px-4 py-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 text-white font-bold text-sm uppercase tracking-wide shadow-lg hover:shadow-xl transition-shadow"
            title="Create new task - Press ⌘N"
          >
            + Task
          </motion.button>

          {/* Theme Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              document.documentElement.classList.toggle('dark');
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Toggle dark mode"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 hidden dark:block" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 block dark:hidden" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.536l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zm5.657-9.193a1 1 0 00-1.414 0l-.707.707A1 1 0 005.05 6.464l.707-.707a1 1 0 001.414-1.414zM5 11a1 1 0 100-2H4a1 1 0 100 2h1z" clipRule="evenodd" />
            </svg>
          </motion.button>

          {/* Profile Dropdown */}
          <div className="relative">
            <motion.button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 text-white font-black flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
            >
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </motion.button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* User Info */}
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <p className="font-bold text-gray-950 dark:text-white">{user?.username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{user?.email}</p>
                    <p className="text-xs font-bold uppercase tracking-widest text-primary-600 mt-2">
                      {user?.role === 'server_admin' ? 'Admin' : 'User'}
                    </p>
                  </div>

                  {/* Menu Items */}
                  <div className="p-2 space-y-1">
                    <motion.a
                      href="/profile"
                      whileHover={{ backgroundColor: 'rgba(183, 75, 2, 0.1)' }}
                      className="block px-4 py-2 text-sm font-bold rounded-lg text-gray-950 dark:text-white transition-colors"
                    >
                      👤 Profile
                    </motion.a>
                    <motion.a
                      href="/settings"
                      whileHover={{ backgroundColor: 'rgba(183, 75, 2, 0.1)' }}
                      className="block px-4 py-2 text-sm font-bold rounded-lg text-gray-950 dark:text-white transition-colors"
                    >
                      ⚙️ Settings
                    </motion.a>

                    {user?.role === 'server_admin' && (
                      <motion.a
                        href="/admin"
                        whileHover={{ backgroundColor: 'rgba(183, 75, 2, 0.1)' }}
                        className="block px-4 py-2 text-sm font-bold rounded-lg text-primary-600 transition-colors"
                      >
                        🔐 Admin Panel
                      </motion.a>
                    )}

                    <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

                    <motion.button
                      onClick={() => {
                        logout();
                        setIsProfileOpen(false);
                      }}
                      whileHover={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                      className="w-full text-left px-4 py-2 text-sm font-bold rounded-lg text-red-600 transition-colors"
                    >
                      🚪 Logout
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default NavbarRefactored;
