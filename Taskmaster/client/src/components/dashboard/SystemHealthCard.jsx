import React, { useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Server,
} from 'lucide-react';
import { DashboardWidgetShell, Badge, Button, DataLoading, QueryErrorBanner } from '../ui';
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
    <li className="flex items-start gap-2 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] px-2.5 py-2 min-w-0">
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
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
          <p className="text-xs font-bold text-[var(--color-text-primary)] break-words min-w-0 sm:flex-1">
            {service.label}
          </p>
          <Badge variant={variant} className="text-[9px] shrink-0 self-start">
            {STATUS_LABEL[service.status] || service.status}
          </Badge>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 break-words">
          {service.state}
          {service.latencyMs != null ? ` · ${service.latencyMs}ms` : ''}
        </p>
        {service.detail && (
          <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5 break-words">
            {service.detail}
          </p>
        )}
        {service.error && (
          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 break-words">
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
        className="min-w-0"
        bodyClassName="p-3 sm:p-4 min-w-0"
      >
        <p className="text-xs text-[var(--color-text-muted)] italic">Admin access required</p>
      </DashboardWidgetShell>
    );
  }

  return (
    <DashboardWidgetShell
      title="System Health"
      icon={Server}
      className="min-w-0"
      headerClassName="h-auto min-h-[44px] py-1.5"
      bodyClassName="p-3 sm:p-4 flex flex-col min-h-[160px] min-w-0 overflow-x-hidden"
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
        <QueryErrorBanner
          message="Could not load system health"
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant={overallVariant} className="text-[10px] font-bold uppercase tracking-wider shrink-0">
              {STATUS_LABEL[data.status] || data.status}
            </Badge>
            <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums break-words min-w-0">
              {checkedLabel ? `Updated ${checkedLabel}` : null}
              {data.uptimeSeconds != null ? ` · up ${Math.floor(data.uptimeSeconds / 60)}m` : ''}
            </span>
          </div>

          <ul className="space-y-1.5 min-h-[8rem] max-h-[min(24rem,50vh)] overflow-y-auto overflow-x-hidden pr-0.5 -mr-0.5">
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
