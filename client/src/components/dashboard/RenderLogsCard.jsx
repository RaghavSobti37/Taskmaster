import React, { useMemo } from 'react';
import { ScrollText, Server } from 'lucide-react';
import { DashboardWidgetShell } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { useStaggerReveal } from '../../hooks/transitions';
import { getRenderLogTargets, openRenderLogs } from '../../config/renderLogs';
import IntegrationLinkRow, { INTEGRATION_TONES, IntegrationLinkGroup } from './IntegrationLinkRow';

function groupByEnvironment(targets) {
  const groups = { production: [], staging: [] };
  targets.forEach((target) => {
    const bucket = target.environment === 'production' ? 'production' : 'staging';
    groups[bucket].push(target);
  });
  return groups;
}

function EnvironmentGroup({ envKey, targets }) {
  const tone = INTEGRATION_TONES[envKey];
  if (!targets.length) return null;

  return (
    <IntegrationLinkGroup title={tone.label}>
      {targets.map((target) => (
        <li key={target.id}>
          <IntegrationLinkRow
            label={target.label}
            subtitle={target.serviceName}
            icon={Server}
            tone={tone}
            onClick={() => openRenderLogs(target.url)}
          />
        </li>
      ))}
    </IntegrationLinkGroup>
  );
}

/** All configured Render log destinations (single dashboard widget). */
export default function RenderLogsCard() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const targets = useMemo(() => getRenderLogTargets(), []);
  const groups = useMemo(() => groupByEnvironment(targets), [targets]);
  const staggerRef = useStaggerReveal([targets.length]);

  if (!isAdmin) return null;

  const configuredCount = targets.length;

  return (
    <DashboardWidgetShell
      title="Render Logs"
      icon={ScrollText}
      bodyClassName="p-3 flex flex-col min-h-[120px]"
      actions={
        configuredCount > 0 ? (
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] tabular-nums">
            {configuredCount} stream{configuredCount === 1 ? '' : 's'}
          </span>
        ) : null
      }
    >
      {configuredCount === 0 && (
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          Add{' '}
          <code className="text-[10px]">VITE_RENDER_SERVICE_ID_*</code>
          {' '}to client env, or full{' '}
          <code className="text-[10px]">VITE_RENDER_LOGS_*_URL</code>
          {' '}overrides. See{' '}
          <code className="text-[10px]">docs/RENDER_LOGGING.md</code>.
        </p>
      )}

      {configuredCount > 0 && (
        <div ref={staggerRef} className="t-stagger space-y-3">
          <EnvironmentGroup envKey="production" targets={groups.production} />
          <EnvironmentGroup envKey="staging" targets={groups.staging} />
        </div>
      )}
    </DashboardWidgetShell>
  );
}
