import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, LayoutTemplate, LayoutDashboard, Clock, Target, CalendarDays, 
  Receipt, LogOut, ArrowLeft 
} from 'lucide-react';
import { PageContainer } from '../../components/ui';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';

// Import sub-pages
import ProfileTab from './tabs/ProfileTab';
import SidebarCustomizationTab from './tabs/SidebarCustomizationTab';
import DashboardCustomizationTab from './tabs/DashboardCustomizationTab';
import AttendanceTab from './tabs/AttendanceTab';
import ProgressTab from './tabs/ProgressTab';
import LeaveTab from './tabs/LeaveTab';
import InvoiceTab from './tabs/InvoiceTab';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState('Profile');

  const tabs = [
    { id: 'Profile', icon: User, label: 'Profile' },
    { id: 'Sidebar', icon: LayoutTemplate, label: 'Sidebar Layout' },
    { id: 'Dashboard', icon: LayoutDashboard, label: 'Dashboard Layout' },
    { id: 'Attendance', icon: Clock, label: 'Attendance' },
    { id: 'Progress', icon: Target, label: 'Progress' },
    { id: 'Leave', icon: CalendarDays, label: 'Apply for Leave' },
    { id: 'Invoice', icon: Receipt, label: 'Raise Invoice' },
  ];

  const handleSignOut = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'Are you sure you want to sign out?',
      confirmLabel: 'Sign out',
      type: 'warning',
    });
    if (!ok) return;
    localStorage.clear();
    window.location.href = '/login';
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Profile': return <ProfileTab />;
      case 'Sidebar': return <SidebarCustomizationTab />;
      case 'Dashboard': return <DashboardCustomizationTab />;
      case 'Attendance': return <AttendanceTab />;
      case 'Progress': return <ProgressTab />;
      case 'Leave': return <LeaveTab />;
      case 'Invoice': return <InvoiceTab />;
      default: return <ProfileTab />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] lg:h-[calc(100vh-2.5rem)] w-full bg-[var(--color-bg-workspace)] overflow-hidden rounded-xl border border-[var(--color-bg-border)] shadow-lg">
      {/* Sidebar Settings Navigation */}
      <aside className="w-64 flex flex-col bg-[var(--color-bg-primary)] border-r border-[var(--color-bg-border)] z-10">
        <div className="p-4 border-b border-[var(--color-bg-border)] flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors">
            <ArrowLeft size={16} className="text-[var(--color-text-secondary)]" />
          </button>
          <h2 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-primary)]">Settings</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${activeTab === tab.id ? 'bg-blue-500/10 text-blue-500' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'}`}
            >
              <tab.icon size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-[var(--color-bg-border)] mt-auto sticky bottom-0 bg-[var(--color-bg-primary)]">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left text-rose-500 hover:bg-rose-500/10"
          >
            <LogOut size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-[var(--color-bg-workspace)] relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default SettingsPage;


// Performance Optimization: useCallback(eventHandler) memoization guard
