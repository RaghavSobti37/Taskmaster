import React, { useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Server,
} from 'lucide-react';
import { DashboardWidgetShell, Badge, Button, DataLoading } from '../ui';
import { useSystemHealth } from '../../hooks/queries/systemHealth';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { formatTimestampWithTz } from '../../utils/displayLabels';

const STATUS_VARIANT = {
  ok: 'success',
  degraded: 'warning',
  down: 'danger',
};

const STATUS_LABEL = {
  ok: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
};

function ServiceRow({ service }) {
  const variant = STATUS_VARIANT[service.status] || 'neutral';
  const Icon = service.status === 'ok'
    ? CheckCircle2
    : service.status === 'down'
      ? AlertCircle
      : Activity;

  return (
    <li className="flex items-start gap-2 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] px-2.5 py-2">
      <Icon
        size={16}
        className={`shrink-0 mt-0.5 ${
          service.status === 'ok'
            ? 'text-emerald-500'
            : service.status === 'down'
              ? 'text-rose-500'
              : 'text-amber-500'
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
            {service.label}
          </p>
          <Badge variant={variant} className="text-[9px] shrink-0">
            {STATUS_LABEL[service.status] || service.status}
          </Badge>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">
          {service.state}
          {service.latencyMs != null ? ` · ${service.latencyMs}ms` : ''}
        </p>
        {service.detail && (
          <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5 truncate">
            {service.detail}
          </p>
        )}
        {service.error && (
          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 line-clamp-2">
            {service.error}
          </p>
        )}
      </div>
    </li>
  );
}

function SystemHealthCard() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useSystemHealth({
    enabled: isAdmin,
    poll: isAdmin,
  });

  const overallVariant = STATUS_VARIANT[data?.status] || 'neutral';
  const checkedLabel = dataUpdatedAt
    ? formatTimestampWithTz(new Date(dataUpdatedAt), 'HH:mm:ss')
    : null;

  const services = useMemo(() => data?.services || [], [data?.services]);

  if (!isAdmin) {
    return (
      <DashboardWidgetShell
        title="System Health"
        icon={Server}
        bodyClassName="p-4"
      >
        <p className="text-xs text-[var(--color-text-muted)] italic">Admin access required</p>
      </DashboardWidgetShell>
    );
  }

  return (
    <DashboardWidgetShell
      title="System Health"
      icon={Server}
      bodyClassName="p-4 flex flex-col min-h-[160px]"
      actions={
        <Button
          size="sm"
          variant="secondary"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider"
          aria-label="Refresh system health"
        >
          {isFetching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        </Button>
      }
    >
      {isLoading && <DataLoading className="!py-3" />}

      {!isLoading && isError && (
        <div className="flex items-start gap-2 text-rose-600 dark:text-rose-400">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p className="text-xs font-medium">Could not load system health</p>
        </div>
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={overallVariant} className="text-[10px] font-bold uppercase tracking-wider">
              {STATUS_LABEL[data.status] || data.status}
            </Badge>
            <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
              {checkedLabel ? `Updated ${checkedLabel}` : null}
              {data.uptimeSeconds != null ? ` · up ${Math.floor(data.uptimeSeconds / 60)}m` : ''}
            </span>
          </div>

          <ul className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5">
            {services.map((service) => (
              <ServiceRow key={service.id} service={service} />
            ))}
          </ul>
        </div>
      )}
    </DashboardWidgetShell>
  );
}

export default SystemHealthCard;
