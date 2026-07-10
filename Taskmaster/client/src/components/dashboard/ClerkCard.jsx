import React, { useMemo } from 'react';
import { Building2, KeyRound, Mail, Settings2, Shield, UserCog, Users, Webhook } from 'lucide-react';
import { DashboardWidgetShell } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { useStaggerReveal } from '../../hooks/transitions';
import {
  getClerkDashboardUrl,
  getClerkQuickLinks,
  isClerkConfigured,
  isClerkDashboardReady,
} from '../../config/clerk';
import IntegrationLinkRow, { INTEGRATION_TONES, IntegrationLinkGroup } from './IntegrationLinkRow';

const CLERK_LINK_ICONS = {
  home: Shield,
  organizations: Building2,
  'org-settings': Settings2,
  users: Users,
  sessions: UserCog,
  'email-auth': Mail,
  'api-keys': KeyRound,
  jwt: KeyRound,
  webhooks: Webhook,
};

export default function ClerkCard() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const configured = isClerkConfigured();
  const dashboardReady = isClerkDashboardReady();
  const links = useMemo(() => getClerkQuickLinks(), []);
  const staggerRef = useStaggerReveal([links.length, configured]);

  const userLinks = links.filter((l) => l.group === 'users');
  const devLinks = links.filter((l) => l.group === 'developer');

  if (!isAdmin) return null;

  return (
    <DashboardWidgetShell
      title="Clerk"
      icon={Shield}
      bodyClassName="p-3 flex flex-col min-h-[120px]"
      actions={(
        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] tabular-nums">
          {links.length} link{links.length === 1 ? '' : 's'}
          {configured ? (
            <span className="ml-1.5 text-emerald-600">· SSO active</span>
          ) : null}
        </span>
      )}
    >
      {!dashboardReady && (
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          Set{' '}
          <code className="text-[10px]">VITE_CLERK_PUBLISHABLE_KEY</code>
          {' '}on Vercel and{' '}
          <code className="text-[10px]">CLERK_SECRET_KEY</code>
          {' '}on Render.
        </p>
      )}

      {dashboardReady && (
        <div ref={staggerRef} className="t-stagger space-y-3">
          <IntegrationLinkGroup title="User management">
            {userLinks.map((link) => {
              const Icon = CLERK_LINK_ICONS[link.id] || Shield;
              return (
                <li key={link.id}>
                  <IntegrationLinkRow
                    label={link.label}
                    subtitle={link.subtitle}
                    icon={Icon}
                    tone={INTEGRATION_TONES.production}
                    onClick={() => window.open(getClerkDashboardUrl(link.path), '_blank', 'noopener,noreferrer')}
                  />
                </li>
              );
            })}
          </IntegrationLinkGroup>

          {devLinks.length > 0 && (
            <IntegrationLinkGroup title="Developer">
              {devLinks.map((link) => {
                const Icon = CLERK_LINK_ICONS[link.id] || KeyRound;
                return (
                  <li key={link.id}>
                    <IntegrationLinkRow
                      label={link.label}
                      subtitle={link.subtitle}
                      icon={Icon}
                      tone={INTEGRATION_TONES.platform}
                      onClick={() => window.open(getClerkDashboardUrl(link.path), '_blank', 'noopener,noreferrer')}
                    />
                  </li>
                );
              })}
            </IntegrationLinkGroup>
          )}
        </div>
      )}
    </DashboardWidgetShell>
  );
}
