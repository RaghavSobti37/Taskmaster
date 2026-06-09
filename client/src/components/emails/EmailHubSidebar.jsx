import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Mail, FileCode, Zap, BarChart2, Newspaper, Plus,
} from 'lucide-react';
const NAV_ITEMS = [
  { to: '/emails', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/emails/campaigns', label: 'Campaigns', icon: Mail },
  { to: '/emails/templates', label: 'Templates', icon: FileCode },
  { to: '/emails/profiles', label: 'Profiles', icon: Zap },
  { to: '/emails/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/emails/newsletter', label: 'Newsletter', icon: Newspaper },
];

export default function EmailHubSidebar() {
  return (
    <aside className="w-full lg:w-52 shrink-0 lg:border-r border-[var(--color-bg-border)] lg:pr-4 space-y-3">
      <div className="hidden lg:block">
        <h2 className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] px-3 mb-2">
          Email Hub
        </h2>
      </div>

      <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-left whitespace-nowrap transition-colors shrink-0 ${
                isActive
                  ? 'bg-[var(--color-action-primary)]/15 text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/30'
                  : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-transparent'
              }`
            }
          >
            <Icon size={14} />
            <span className="text-[10px] font-black uppercase tracking-wide">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="hidden lg:block px-1 pt-2 border-t border-[var(--color-bg-border)]">
        <NavLink
          to="/emails/create"
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide bg-[var(--color-action-primary)] text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Create Campaign
        </NavLink>
      </div>
    </aside>
  );
}
