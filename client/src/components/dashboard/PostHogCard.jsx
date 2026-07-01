import React, { useMemo } from 'react';
import { BarChart3, LineChart, Radio, Users } from 'lucide-react';
import { DashboardWidgetShell } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { useStaggerReveal } from '../../hooks/transitions';
import {
  getPostHogProjectId,
  isPostHogCaptureConfigured,
  isPostHogDashboardReady,
  openPostHogDashboard,
} from '../../config/posthog';
import IntegrationLinkRow, { INTEGRATION_TONES, IntegrationLinkGroup } from './IntegrationLinkRow';

const ANALYTICS_LINKS = [
  { id: 'home', label: 'Project home', subtitle: 'CoreKnot', icon: BarChart3, path: '' },
  { id: 'insights', label: 'Insights', subtitle: 'Trends & funnels', icon: LineChart, path: 'insights' },
  { id: 'dashboards', label: 'Dashboards', subtitle: 'Saved views', icon: BarChart3, path: 'dashboards' },
  { id: 'persons', label: 'People', subtitle: 'User profiles', icon: Users, path: 'persons' },
  { id: 'replay', label: 'Session replay', subtitle: 'Recordings', icon: Radio, path: 'replay' },
];

export default function PostHogCard() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const dashboardReady = isPostHogDashboardReady();
  const captureActive = isPostHogCaptureConfigured();
  const projectId = getPostHogProjectId();
  const linkCount = ANALYTICS_LINKS.length;
  const staggerRef = useStaggerReveal([linkCount, captureActive]);

  const statusHint = useMemo(() => {
    if (captureActive) return 'Capture active';
    if (dashboardReady) return 'Dashboard only';
    return null;
  }, [captureActive, dashboardReady]);

  if (!isAdmin) return null;

  return (
    <DashboardWidgetShell
      title="PostHog"
      icon={BarChart3}
      bodyClassName="p-3 flex flex-col min-h-[120px]"
      actions={(
        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] tabular-nums">
          {linkCount} link{linkCount === 1 ? '' : 's'}
          {statusHint ? (
            <span className={`ml-1.5 ${captureActive ? 'text-emerald-600' : 'text-[var(--color-text-muted)]'}`}>
              · {statusHint}
            </span>
          ) : null}
        </span>
      )}
    >
      {!dashboardReady && (
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          Set{' '}
          <code className="text-[10px]">VITE_POSTHOG_APP_URL</code>
          {' '}or{' '}
          <code className="text-[10px]">VITE_POSTHOG_PROJECT_ID</code>
          {' '}on Vercel Production.
        </p>
      )}

      {dashboardReady && (
        <div ref={staggerRef} className="t-stagger space-y-3">
          <IntegrationLinkGroup title={INTEGRATION_TONES.production.label}>
            {ANALYTICS_LINKS.map((link) => (
              <li key={link.id}>
                <IntegrationLinkRow
                  label={link.label}
                  subtitle={link.id === 'home' ? `project/${projectId}` : link.subtitle}
                  icon={link.icon}
                  tone={INTEGRATION_TONES.production}
                  onClick={() => openPostHogDashboard(link.path)}
                />
              </li>
            ))}
          </IntegrationLinkGroup>

          {!captureActive && (
            <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed px-0.5">
              Event capture needs{' '}
              <code className="text-[9px]">VITE_POSTHOG_PROJECT_TOKEN</code>
              {' '}on Vercel (same{' '}
              <code className="text-[9px]">phc_</code>
              {' '}key as Render).
            </p>
          )}
        </div>
      )}
    </DashboardWidgetShell>
  );
}
