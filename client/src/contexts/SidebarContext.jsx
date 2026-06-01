import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext();

const SIDEBAR_STORAGE_KEY = 'coreknot-sidebar-open';

export const SIDEBAR_WIDTH_OPEN = 160;
export const SIDEBAR_WIDTH_COLLAPSED = 56;

export const SidebarProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return saved !== 'false';
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState('Default');

  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleMobileSidebar = () => setIsMobileOpen(!isMobileOpen);
  const closeMobileSidebar = () => setIsMobileOpen(false);

  return (
    <SidebarContext.Provider value={{ 
      isOpen, 
      toggleSidebar, 
      isMobileOpen, 
      toggleMobileSidebar, 
      closeMobileSidebar,
      activeWorkspace, 
      setActiveWorkspace 
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);
