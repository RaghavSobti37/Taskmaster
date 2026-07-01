import React from 'react';
import { BarChart3, ExternalLink, LineChart, Radio, Users } from 'lucide-react';
import { DashboardWidgetShell, Button } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import {
  getPostHogAppUrl,
  isPostHogConfigured,
  openPostHogDashboard,
} from '../../config/posthog';

const QUICK_LINKS = [
  { id: 'home', label: 'Project home', icon: BarChart3, path: '' },
  { id: 'insights', label: 'Insights', icon: LineChart, path: 'insights' },
  { id: 'dashboards', label: 'Dashboards', icon: BarChart3, path: 'dashboards' },
  { id: 'persons', label: 'People', icon: Users, path: 'persons' },
  { id: 'replay', label: 'Session replay', icon: Radio, path: 'replay' },
];

export default function PostHogCard() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const configured = isPostHogConfigured();
  const appUrl = getPostHogAppUrl();

  if (!isAdmin) return null;

  return (
    <DashboardWidgetShell
      title="PostHog"
      icon={BarChart3}
      bodyClassName="p-4 flex flex-col min-h-[120px]"
      actions={(
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider"
          onClick={() => openPostHogDashboard()}
        >
          <ExternalLink size={12} />
          Open
        </Button>
      )}
    >
      {!configured && (
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-3">
          Set{' '}
          <code className="text-[10px]">VITE_POSTHOG_PROJECT_TOKEN</code>
          {' '}on Vercel Production (same{' '}
          <code className="text-[10px]">phc_</code>
          {' '}key as Render{' '}
          <code className="text-[10px]">POSTHOG_PROJECT_API_KEY</code>
          ). Dashboard link still works below.
        </p>
      )}
      {configured && (
        <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 mb-2">
          Capture active after cookie consent
        </p>
      )}
      <p className="text-sm font-bold text-[var(--color-text-primary)] mb-2 truncate" title={appUrl}>
        CoreKnot production analytics
      </p>
      <ul className="space-y-1.5">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <li key={link.id}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full justify-between gap-2 h-8 text-[10px] font-semibold"
                onClick={() => openPostHogDashboard(link.path)}
              >
                <span className="flex items-center gap-2 truncate">
                  <Icon size={14} className="shrink-0 opacity-70" aria-hidden />
                  {link.label}
                </span>
                <ExternalLink size={12} className="shrink-0 opacity-60" aria-hidden />
              </Button>
            </li>
          );
        })}
      </ul>
    </DashboardWidgetShell>
  );
}
