import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, LayoutDashboard, Clock, Target, CalendarDays,
  Receipt, LogOut, ArrowLeft, Shield, Keyboard, Bell
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { globalConfirm } from '../../contexts/confirmContext';
import { createLazyWithRetry } from '../../utils/lazyWithRetry';
import PageSkeleton from '../../components/ui/PageSkeleton';

const lazyWithRetry = createLazyWithRetry;

const SETTINGS_TAB_LOADERS = {
  Profile: () => lazyWithRetry(() => import('./tabs/ProfileTab')),
  Security: () => lazyWithRetry(() => import('./tabs/SessionsTab')),
  Keyboard: () => lazyWithRetry(() => import('./tabs/KeyboardShortcutsTab')),
  Notifications: () => lazyWithRetry(() => import('./tabs/NotificationsTab')),
  Dashboard: () => lazyWithRetry(() => import('./tabs/DashboardCustomizationTab')),
  Attendance: () => lazyWithRetry(() => import('./tabs/AttendanceTab')),
  Progress: () => lazyWithRetry(() => import('./tabs/ProgressTab')),
  Leave: () => lazyWithRetry(() => import('./tabs/LeaveTab')),
  Invoice: () => lazyWithRetry(() => import('./tabs/InvoiceTab')),
};

const settingsTabCache = new Map();
function getLazySettingsTab(tabId) {
  const loader = SETTINGS_TAB_LOADERS[tabId];
  if (!loader) return null;
  if (!settingsTabCache.has(tabId)) settingsTabCache.set(tabId, loader());
  return settingsTabCache.get(tabId);
}

const SettingsPage = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('Profile');

  const tabs = [
    { id: 'Profile', icon: User, label: 'Profile' },
    { id: 'Security', icon: Shield, label: 'Security' },
    { id: 'Keyboard', icon: Keyboard, label: 'Shortcuts' },
    { id: 'Notifications', icon: Bell, label: 'Notifications' },
    { id: 'Dashboard', icon: LayoutDashboard, label: 'Dashboard Layout' },
    { id: 'Attendance', icon: Clock, label: 'Attendance' },
    { id: 'Progress', icon: Target, label: 'Progress' },
    { id: 'Leave', icon: CalendarDays, label: 'Leave' },
    { id: 'Invoice', icon: Receipt, label: 'Reimbursement' },
  ];

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (!tab) return;
    const match = tabs.find((t) => t.id.toLowerCase() === tab.toLowerCase());
    if (match) setActiveTab(match.id);
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId.toLowerCase() });
  };

  const handleSignOut = async () => {
    const ok = await globalConfirm.confirm({
      title: 'Sign out?',
      message: 'Are you sure you want to sign out?',
      confirmLabel: 'Sign out',
      type: 'warning',
    });
    if (!ok) return;
    await logout();
    window.location.href = '/login';
  };

  const renderTabContent = () => {
    const LazyTab = getLazySettingsTab(activeTab) || getLazySettingsTab('Profile');
    if (!LazyTab) return null;
    const Tab = LazyTab;
    return <Tab />;
  };

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-2.5rem)] w-full min-w-0 bg-[var(--color-bg-workspace)] overflow-hidden border border-[var(--color-bg-border)]">
      {/* Mobile tab pills */}
      <div className="lg:hidden shrink-0 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-3">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors shrink-0"
            aria-label="Back"
          >
            <ArrowLeft size={16} className="text-[var(--color-text-secondary)]" />
          </button>
          <h2 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-primary)]">Settings</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)] border-[var(--color-action-primary)]/30'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-bg-border)]'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-full text-[10px] font-bold uppercase tracking-wider border border-rose-500/30 text-rose-500 bg-rose-500/10"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-[var(--color-bg-primary)] border-r border-[var(--color-bg-border)] z-10">
        <div className="p-4 border-b border-[var(--color-bg-border)] flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors flex shrink-0 items-center justify-center">
            <ArrowLeft size={16} className="text-[var(--color-text-secondary)]" />
          </button>
          <h2 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-primary)] truncate">Settings</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${activeTab === tab.id ? 'bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'}`}
            >
              <tab.icon size={16} className="shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider truncate">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-[var(--color-bg-border)] mt-auto sticky bottom-0 bg-[var(--color-bg-primary)]">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left text-rose-500 hover:bg-rose-500/10"
          >
            <LogOut size={16} className="shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider truncate">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-[var(--color-bg-workspace)] relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full min-w-0"
          >
            <Suspense fallback={<PageSkeleton />}>
              {renderTabContent()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default SettingsPage;
