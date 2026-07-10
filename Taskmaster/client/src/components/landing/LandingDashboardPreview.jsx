import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Mail,
  Calendar,
  BarChart3,
} from 'lucide-react';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: FolderKanban, label: 'Projects' },
  { icon: Users, label: 'CRM' },
  { icon: Mail, label: 'Campaigns' },
  { icon: Calendar, label: 'Calendar' },
];

const STATS = [
  { label: 'Projects', value: '128' },
  { label: 'Tasks', value: '342' },
  { label: 'Leads', value: '56' },
  { label: 'Campaigns', value: '12' },
];

const ACTIVITY = [
  { text: 'Sarah completed "Q2 Launch Review"', time: '2m ago' },
  { text: 'New lead added: Acme Corp', time: '15m ago' },
  { text: 'Campaign "Newsletter #14" sent', time: '1h ago' },
];

/** CSS-only dashboard mockup for landing hero — no external assets */
export default function LandingDashboardPreview() {
  return (
    <div
      className="tm-floating w-full max-w-lg mx-auto rounded-2xl border border-[var(--landing-beige)] bg-white shadow-xl shadow-[var(--landing-green-dark)]/10 overflow-hidden"
      aria-hidden="true"
    >
      <div className="flex min-h-[320px] sm:min-h-[360px]">
        {/* Sidebar */}
        <aside className="hidden sm:flex w-[72px] shrink-0 flex-col items-center gap-1 border-r border-[var(--landing-beige)] bg-[var(--landing-beige)]/40 py-4">
          {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                active
                  ? 'bg-[var(--landing-green-dark)] text-white'
                  : 'text-[var(--landing-green-mid)]'
              }`}
              title={label}
            >
              <Icon size={16} strokeWidth={2} />
            </div>
          ))}
        </aside>

        {/* Main panel */}
        <div className="flex-1 p-4 sm:p-5 space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--landing-green-dark)] truncate">
              Workspace Overview
            </span>
            <span className="text-[10px] text-[var(--landing-green-mid)] shrink-0">Today</span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STATS.map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg border border-[var(--landing-beige)] bg-[var(--landing-beige)]/30 px-2.5 py-2"
              >
                <div className="text-[10px] text-[var(--landing-green-mid)] font-medium">{label}</div>
                <div className="text-sm font-bold text-[var(--landing-green-dark)]">{value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Activity feed */}
            <div className="rounded-lg border border-[var(--landing-beige)] p-3 space-y-2">
              <div className="text-[10px] font-bold text-[var(--landing-green-dark)] uppercase tracking-wide">
                Team Activity
              </div>
              {ACTIVITY.map((item) => (
                <div key={item.text} className="text-[10px] leading-snug">
                  <span className="text-[var(--landing-green-dark)] font-medium block truncate">
                    {item.text}
                  </span>
                  <span className="text-[var(--landing-green-mid)]">{item.time}</span>
                </div>
              ))}
            </div>

            {/* Chart placeholder */}
            <div className="rounded-lg border border-[var(--landing-beige)] p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart3 size={12} className="text-[var(--landing-accent)]" />
                <span className="text-[10px] font-bold text-[var(--landing-green-dark)]">
                  Project Progress
                </span>
              </div>
              <div className="flex items-end gap-1 h-16">
                {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm bg-[var(--landing-green-mid)]"
                    style={{
                      height: `${h}%`,
                      opacity: i === 5 ? 1 : 0.35 + i * 0.08,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
