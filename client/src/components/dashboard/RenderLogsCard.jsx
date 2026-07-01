import React, { useMemo } from 'react';
import { ExternalLink, ScrollText, Server } from 'lucide-react';
import { DashboardWidgetShell } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { useStaggerReveal } from '../../hooks/transitions';
import { getRenderLogTargets, openRenderLogs } from '../../config/renderLogs';

const ENV_TONE = {
  production: {
    label: 'Production',
    badge: 'badge-mint',
    accent: 'border-l-[var(--color-pastel-mint-text)]',
    chip: 'bg-[var(--color-pastel-mint-bg)] text-[var(--color-pastel-mint-text)]',
  },
  staging: {
    label: 'Staging',
    badge: 'badge-apricot',
    accent: 'border-l-[var(--color-pastel-apricot-text)]',
    chip: 'bg-[var(--color-pastel-apricot-bg)] text-[var(--color-pastel-apricot-text)]',
  },
};

function groupByEnvironment(targets) {
  const groups = { production: [], staging: [] };
  targets.forEach((target) => {
    const bucket = target.environment === 'production' ? 'production' : 'staging';
    groups[bucket].push(target);
  });
  return groups;
}

function LogStreamRow({ target, tone }) {
  return (
    <button
      type="button"
      onClick={() => openRenderLogs(target.url)}
      className={[
        'group w-full text-left rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)]',
        'bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-secondary)]',
        'border-l-[3px] transition-colors',
        tone.accent,
      ].join(' ')}
    >
      <span className="flex items-center gap-3 p-2.5 min-h-[44px]">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.chip}`}
          aria-hidden
        >
          <Server size={15} strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-action-primary)] transition-colors">
            {target.label}
          </span>
          <span className="block text-[10px] text-[var(--color-text-muted)] font-mono truncate mt-0.5">
            {target.serviceName}
          </span>
        </span>
        <ExternalLink
          size={14}
          className="shrink-0 text-[var(--color-text-muted)] opacity-50 group-hover:opacity-100 transition-opacity"
          aria-hidden
        />
      </span>
    </button>
  );
}

function EnvironmentGroup({ envKey, targets }) {
  const tone = ENV_TONE[envKey];
  if (!targets.length) return null;

  return (
    <div className="space-y-1.5">
      <p className="tm-section-label px-0.5">{tone.label}</p>
      <ul className="space-y-1.5">
        {targets.map((target) => (
          <li key={target.id}>
            <LogStreamRow target={target} tone={tone} />
          </li>
        ))}
      </ul>
    </div>
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
