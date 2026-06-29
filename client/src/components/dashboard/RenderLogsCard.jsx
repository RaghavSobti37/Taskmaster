import React, { useMemo } from 'react';
import { ExternalLink, ScrollText } from 'lucide-react';
import { DashboardWidgetShell, Button } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import {
  getRenderLogTarget,
  getRenderLogTargets,
  openRenderLogs,
} from '../../config/renderLogs';

function LogTargetButton({ target, compact = false }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={`w-full justify-between gap-2 font-semibold ${compact ? 'h-8 text-[10px]' : 'h-9 text-xs'}`}
      onClick={() => openRenderLogs(target.url)}
    >
      <span className="truncate text-left">
        {target.label}
        <span className="block text-[9px] font-normal text-[var(--color-text-muted)] truncate">
          {target.serviceName}
        </span>
      </span>
      <ExternalLink size={14} className="shrink-0 opacity-70" aria-hidden />
    </Button>
  );
}

/** Single-environment shortcut (dashboard widget id: render-logs-{targetId suffix}). */
export function RenderLogTargetCard({ targetId }) {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const target = useMemo(() => getRenderLogTarget(targetId), [targetId]);

  if (!isAdmin) return null;

  return (
    <DashboardWidgetShell
      title={target?.label || 'Render Logs'}
      icon={ScrollText}
      bodyClassName="p-4 flex flex-col min-h-[100px]"
      actions={
        target ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider"
            onClick={() => openRenderLogs(target.url)}
          >
            <ExternalLink size={12} />
            Open
          </Button>
        ) : null
      }
    >
      {!target && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Set{' '}
          <code className="text-[10px]">VITE_RENDER_SERVICE_ID_*</code>
          {' '}in client env. See{' '}
          <code className="text-[10px]">docs/RENDER_LOGGING.md</code>.
        </p>
      )}
      {target && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
            Render log stream
          </p>
          <p className="text-sm font-bold text-[var(--color-text-primary)]">{target.serviceName}</p>
          <LogTargetButton target={target} compact />
        </div>
      )}
    </DashboardWidgetShell>
  );
}

/** All configured Render log destinations. */
export default function RenderLogsCard() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const targets = useMemo(() => getRenderLogTargets(), []);

  if (!isAdmin) return null;

  return (
    <DashboardWidgetShell
      title="Render Logs"
      icon={ScrollText}
      bodyClassName="p-4 flex flex-col min-h-[120px]"
    >
      {targets.length === 0 && (
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          Add{' '}
          <code className="text-[10px]">VITE_RENDER_SERVICE_ID_PRODUCTION</code>
          ,{' '}
          <code className="text-[10px]">VITE_RENDER_SERVICE_ID_STAGING_API</code>
          , and/or{' '}
          <code className="text-[10px]">VITE_RENDER_SERVICE_ID_STAGING_NEST</code>
          {' '}to client env (or full <code className="text-[10px]">VITE_RENDER_LOGS_*_URL</code> overrides).
          Service IDs are the <code className="text-[10px]">srv-…</code> from Render Dashboard.
        </p>
      )}
      {targets.length > 0 && (
        <ul className="space-y-2">
          {targets.map((target) => (
            <li key={target.id}>
              <LogTargetButton target={target} />
            </li>
          ))}
        </ul>
      )}
    </DashboardWidgetShell>
  );
}
