import React, { useMemo } from 'react';
import { BarChart3, ExternalLink } from 'lucide-react';
import { DashboardWidgetShell, Button } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import {
  getPostHogDashboardUrl,
  getPostHogRegion,
  isPostHogDashboardConfigured,
  openPostHogDashboard,
  posthogUiHost,
} from '../../config/posthogDashboard';
import { isPostHogEnabled } from '../../lib/posthog';

export default function PostHogDashboardCard() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const dashboardUrl = useMemo(() => getPostHogDashboardUrl(), []);
  const region = useMemo(() => getPostHogRegion(), []);
  const uiHost = posthogUiHost(region);
  const capturing = isPostHogEnabled();
  const configured = isPostHogDashboardConfigured();

  if (!isAdmin) return null;

  return (
    <DashboardWidgetShell
      title="PostHog Analytics"
      icon={BarChart3}
      bodyClassName="p-4 flex flex-col min-h-[120px]"
      actions={(
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider"
          onClick={() => openPostHogDashboard(dashboardUrl)}
        >
          <ExternalLink size={12} />
          Open
        </Button>
      )}
    >
      {!configured && (
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          Set{' '}
          <code className="text-[10px]">VITE_POSTHOG_PROJECT_TOKEN</code>
          {' '}on Vercel Production (prod project) and in local{' '}
          <code className="text-[10px]">client/.env</code>
          {' '}(dev project). Optional:{' '}
          <code className="text-[10px]">VITE_POSTHOG_PROJECT_ID</code>
          {' '}or{' '}
          <code className="text-[10px]">VITE_POSTHOG_DASHBOARD_URL</code>
          {' '}for a direct dashboard link.
        </p>
      )}
      {configured && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
            {capturing ? 'Capturing events' : 'Awaiting consent or token'}
          </p>
          <p className="text-sm font-bold text-[var(--color-text-primary)]">
            {uiHost.replace('https://', '')}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Use separate PostHog projects for localhost vs production so test data does not pollute prod analytics.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full justify-between gap-2 font-semibold h-9 text-xs"
            onClick={() => openPostHogDashboard(dashboardUrl)}
          >
            <span className="truncate text-left">Open PostHog dashboard</span>
            <ExternalLink size={14} className="shrink-0 opacity-70" aria-hidden />
          </Button>
        </div>
      )}
    </DashboardWidgetShell>
  );
}
