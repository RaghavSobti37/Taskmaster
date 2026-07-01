import React, { useMemo } from 'react';
import { Shield, Users, Layers } from 'lucide-react';
import { ListPageLayout, PageSkeleton, Badge, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import OrgRolesPanel from '../../components/admin/OrgRolesPanel';
import { useAdminRoles } from '../../hooks/queries/adminRoles';

const AdminRolesPage = () => {
  const { data, isLoading, isError, error, refetch } = useAdminRoles();

  const orgRoles = data?.orgRoles || [];
  const projectRoles = data?.projectRoles || [];

  const stats = useMemo(() => [
    {
      id: 'org-roles',
      label: 'Org Roles',
      value: orgRoles.length,
      icon: Shield,
      variant: 'info',
      info: 'Department-based org roles with page access.',
    },
    {
      id: 'assigned',
      label: 'Assigned Users',
      value: orgRoles.reduce((sum, r) => sum + (r.memberCount || 0), 0),
      icon: Users,
      variant: 'mint',
      info: 'Users mapped to an org role.',
    },
    {
      id: 'project-roles',
      label: 'Project Roles',
      value: projectRoles.length,
      icon: Layers,
      variant: 'slate',
      info: 'Fixed project membership levels (read-only).',
    },
  ], [orgRoles, projectRoles.length]);

  if (isLoading) return <PageSkeleton />;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      title="Roles & Permissions"
      icon={Shield}
      backTo={ADMIN_CONSOLE_PATH}
      overview={{ stats }}
    >
      {isError && (
        <QueryErrorBanner
          className="mb-4"
          message={getQueryErrorMessage(error, 'Failed to load roles')}
          onRetry={() => refetch()}
        />
      )}
      {!isError && (
        <div className="space-y-8">
          <OrgRolesPanel orgRoles={orgRoles} />

          <section className="space-y-3 min-w-0">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Project roles</h2>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Fixed per-project membership levels — assigned on each project, not org-wide.
              </p>
            </div>
            <div className="border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] overflow-hidden bg-[var(--color-bg-primary)]">
              <div className="hidden md:grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.5fr)] gap-3 px-4 py-2 bg-[var(--color-bg-secondary)] text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                <span>Role</span>
                <span className="text-center">Rank</span>
                <span>Capabilities</span>
              </div>
              {projectRoles.map((role) => (
                <div
                  key={role.key}
                  className="border-t border-[var(--color-bg-border)] first:border-t-0"
                >
                  <div className="hidden md:grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.5fr)] gap-3 px-4 py-3 items-start">
                    <div className="min-w-0">
                      <span className="text-sm font-bold">{role.label}</span>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{role.description}</p>
                    </div>
                    <Badge variant="info" className="!text-[9px] font-mono justify-self-center">
                      {role.rank}
                    </Badge>
                    <p className="text-[10px] text-[var(--color-text-secondary)] leading-relaxed">
                      {(role.capabilities || []).join(' · ')}
                    </p>
                  </div>
                  <div className="md:hidden px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold">{role.label}</span>
                      <Badge variant="info" className="!text-[9px] font-mono shrink-0">
                        Rank {role.rank}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{role.description}</p>
                    <ul className="space-y-1">
                      {(role.capabilities || []).map((cap) => (
                        <li key={cap} className="text-[10px] text-[var(--color-text-secondary)] flex items-start gap-1.5">
                          <span className="text-[var(--color-action-primary)] mt-0.5">•</span>
                          <span>{cap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </ListPageLayout>
  );
};

export default AdminRolesPage;
