import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { resolveSidebarDefaultOpen } from '../utils/activeFilterChips';

const SidebarContext = createContext();

const SIDEBAR_STORAGE_KEY = 'coreknot-sidebar-open';
const DENSITY_STORAGE_KEY = 'coreknot-ui-density';

export const SIDEBAR_WIDTH_OPEN = 216;
export const SIDEBAR_WIDTH_COLLAPSED = 40;
export const SIDEBAR_SHELL_GUTTER = 10;
export const SIDEBAR_MOBILE_SHELL_WIDTH = SIDEBAR_WIDTH_OPEN + SIDEBAR_SHELL_GUTTER * 2;
export const SIDEBAR_SHELL_WIDTH_OPEN = SIDEBAR_WIDTH_OPEN + SIDEBAR_SHELL_GUTTER * 2;
export const SIDEBAR_SHELL_WIDTH_COLLAPSED = SIDEBAR_WIDTH_COLLAPSED + SIDEBAR_SHELL_GUTTER * 2;

export const SidebarProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return resolveSidebarDefaultOpen(saved);
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isOpen));
    } catch {
      /* ignore */
    }
  }, [isOpen]);

  const [density, setDensity] = useState(() => {
    try {
      return localStorage.getItem(DENSITY_STORAGE_KEY) === 'compact' ? 'compact' : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, density);
    } catch {
      /* ignore */
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute(
        'data-density',
        density === 'compact' ? 'compact' : 'comfortable',
      );
    }
  }, [density]);

  const toggleDensity = () => {
    setDensity((current) => (current === 'compact' ? 'comfortable' : 'compact'));
  };

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState('Default');
  const mobileMenuTriggerRef = useRef(null);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleMobileSidebar = () => setIsMobileOpen((open) => !open);
  const closeMobileSidebar = (options = {}) => {
    setIsMobileOpen(false);
    if (options.returnFocus) {
      mobileMenuTriggerRef.current?.focus();
    }
  };

  return (
    <SidebarContext.Provider value={{
      isOpen,
      toggleSidebar,
      isMobileOpen,
      toggleMobileSidebar,
      closeMobileSidebar,
      mobileMenuTriggerRef,
      activeWorkspace,
      setActiveWorkspace,
      density,
      setDensity,
      toggleDensity,
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);
