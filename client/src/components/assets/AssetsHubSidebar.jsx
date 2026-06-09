import React from 'react';
import { NavLink } from 'react-router-dom';
import { Link2, KeyRound } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/assets', label: 'File Links', icon: Link2, end: true },
  { to: '/assets/accounts', label: 'Managed Accounts', icon: KeyRound, end: true },
];

export default function AssetsHubSidebar() {

  return (
    <aside className="w-full lg:w-52 shrink-0 lg:border-r border-[var(--color-bg-border)] lg:pr-4 space-y-3">
      <div className="hidden lg:block">
        <h2 className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] px-3 mb-2">
          Assets Hub
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
                  ? 'bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/30'
                  : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-transparent'
              }`
            }
          >
            <Icon size={14} />
            <span className="text-[10px] font-black uppercase tracking-wide">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
