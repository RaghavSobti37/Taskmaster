import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ChevronDown, Plus, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OrganizationSwitcher, useAuth as useClerkAuth, useClerk } from '@clerk/react';
import { isClerkConfigured } from '../../config/clerk';
import { isOrgFirstAuthEnabled } from '../../lib/orgFirstAuth';
import { reestablishClerkOrgSession } from '../../lib/reestablishClerkOrgSession';
import { useAuth } from '../../contexts/AuthContext';

const fetchMemberships = async () => {
  const { data } = await axios.get('/api/tenants/memberships', { withCredentials: true });
  return data;
};

const orgInitials = (name) => {
  const parts = String(name || 'Organization').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || 'OR').toUpperCase();
};

const planTierLabel = (plan) => {
  if (!plan || plan === 'free') return null;
  if (plan === 'enterprise') return 'Enterprise';
  if (plan === 'pro') return 'Pro';
  return String(plan).charAt(0).toUpperCase() + String(plan).slice(1);
};

function OrgAvatar({ tenant, size = 'md', className = '' }) {
  const name = tenant?.name || 'Organization';
  const logoUrl = tenant?.logoUrl;
  const dim = size === 'sm' ? 'h-5 w-5 text-[9px]' : size === 'lg' ? 'h-7 w-7 text-[11px]' : 'h-6 w-6 text-[10px]';

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${dim} shrink-0 rounded-md border border-[var(--color-bg-border)] object-cover ${className}`}
      />
    );
  }

  return (
    <span className={`tm-org-avatar ${dim} shrink-0 ${className}`} aria-hidden>
      {orgInitials(name)}
    </span>
  );
}

function OrgSwitcherFooterActions({ onNavigate }) {
  const navigate = useNavigate();
  const go = (path) => {
    onNavigate?.();
    navigate(path);
  };

  return (
    <>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]"
        onClick={() => go('/settings?tab=organization')}
      >
        <Settings size={14} className="text-[var(--color-action-primary)]" aria-hidden />
        Organization settings
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-[var(--color-action-primary)] hover:bg-[var(--color-bg-elevated)]"
        onClick={() => go('/org/create')}
      >
        <Plus size={14} aria-hidden />
        Create organization
      </button>
    </>
  );
}

function ClerkOrgSwitcherPanel({ variant, className }) {
  const isSidebar = variant === 'sidebar' || variant === 'sidebar-collapsed';
  const isCollapsed = variant === 'sidebar-collapsed';
  const { orgId } = useClerkAuth();
  const { getToken, setActive } = useClerk();
  const { confirmSessionFromEstablish } = useAuth();
  const queryClient = useQueryClient();
  const prevOrgRef = useRef(orgId);
  const switchingRef = useRef(false);

  useEffect(() => {
    if (!orgId || switchingRef.current) return;
    if (prevOrgRef.current === null) {
      prevOrgRef.current = orgId;
      return;
    }
    if (orgId === prevOrgRef.current) return;

    prevOrgRef.current = orgId;
    switchingRef.current = true;

    reestablishClerkOrgSession({
      getToken,
      setActive,
      orgId,
      confirmSessionFromEstablish,
    })
      .then(() => {
        queryClient.clear();
        window.location.reload();
      })
      .catch(() => {
        switchingRef.current = false;
      });
  }, [orgId, getToken, setActive, confirmSessionFromEstablish, queryClient]);

  return (
    <div
      className={`${isSidebar ? 'tm-sidebar-org tm-sidebar-org-clerk' : ''} ${className}`.trim()}
      data-org-switcher="clerk"
    >
      {!isCollapsed && (
        <span className="tm-sidebar-org-secondary-label text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Switch workspace
        </span>
      )}
      <OrganizationSwitcher
        hidePersonal
        appearance={{
          elements: {
            organizationSwitcherTrigger: isCollapsed
              ? 'tm-sidebar-org-trigger !w-auto !p-1.5 !justify-center'
              : isSidebar
                ? 'tm-sidebar-org-trigger w-full'
                : 'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs',
          },
        }}
      />
      {!isCollapsed && (
        <div className="mt-1.5 space-y-0.5 border-t border-[var(--color-bg-border)] pt-1.5">
          <OrgSwitcherFooterActions />
        </div>
      )}
    </div>
  );
}

export default function OrgSwitcher({ variant = 'default', className = '' }) {
  const orgFirst = isOrgFirstAuthEnabled();
  const useClerkSwitcher = orgFirst && isClerkConfigured();

  if (useClerkSwitcher) {
    return <ClerkOrgSwitcherPanel variant={variant} className={className} />;
  }

  return (
    <LegacyOrgSwitcher
      variant={variant}
      className={className}
      orgFirst={orgFirst}
    />
  );
}

function LegacyOrgSwitcher({ variant = 'default', className = '', orgFirst = false }) {
  const isSidebar = variant === 'sidebar' || variant === 'sidebar-collapsed';
  const isCollapsed = variant === 'sidebar-collapsed';
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tenantMemberships'],
    queryFn: fetchMemberships,
    staleTime: 60_000,
  });

  const selectMutation = useMutation({
    mutationFn: async (tenantId) => {
      await axios.post('/api/tenants/select', { tenantId }, { withCredentials: true });
      return tenantId;
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.reload();
    },
  });

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const memberships = data?.memberships || [];
  const activeId = String(data?.activeTenantId || '');
  const active = memberships.find((m) => String(m.tenant?._id || m.tenant) === activeId)
    || memberships[0];

  const orgName = active?.tenant?.name || 'Organization';
  const planLabel = planTierLabel(active?.tenant?.plan);
  const switchLabel = orgFirst ? 'Switch workspace' : 'Switch organization';

  const menuClass = isCollapsed
    ? 'absolute left-full top-0 z-[60] ml-1 min-w-[220px] rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] p-1 shadow-lg'
    : isSidebar
      ? 'tm-sidebar-org-menu'
      : 'absolute right-0 z-50 mt-1 min-w-[220px] rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] p-1 shadow-lg';

  const triggerClass = isCollapsed
    ? 'tm-sidebar-org-trigger !w-auto !p-1.5 !justify-center'
    : isSidebar
      ? 'tm-sidebar-org-trigger group'
      : 'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors';

  return (
    <div
      ref={rootRef}
      className={`relative min-w-0 ${isSidebar ? 'tm-sidebar-org' : ''} ${className}`.trim()}
      data-org-switcher="legacy"
    >
      {orgFirst && isSidebar && !isCollapsed ? (
        <span className="tm-sidebar-org-secondary-label mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Switch workspace
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${switchLabel} — ${orgName}`}
        title={orgName}
        disabled={isLoading && !isError}
      >
        <OrgAvatar tenant={active?.tenant} size={isCollapsed ? 'lg' : 'md'} />
        {!isCollapsed && (
          <>
            <span className={isSidebar ? 'tm-sidebar-org-trigger-label' : 'max-w-[140px] truncate'}>
              {isLoading ? 'Loading…' : orgName}
            </span>
            {planLabel && (
              <span className="tm-sidebar-org-plan">{planLabel}</span>
            )}
            <ChevronDown
              size={14}
              className={`shrink-0 text-[var(--color-action-primary)] transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </>
        )}
      </button>
      {open && (
        <div
          className={menuClass}
          role="listbox"
          aria-label={switchLabel}
        >
          {memberships.map((m) => {
            const id = String(m.tenant?._id || m.tenant);
            const name = m.tenant?.name || 'Organization';
            const tier = planTierLabel(m.tenant?.plan);
            const selected = id === activeId || (memberships.length === 1 && !activeId);
            return (
              <button
                key={m.id || id}
                type="button"
                role="option"
                aria-selected={selected}
                title={name}
                className={`flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-[var(--color-bg-elevated)] ${selected ? 'font-semibold text-[var(--color-action-primary)]' : 'text-[var(--color-text-primary)]'}`}
                onClick={() => {
                  setOpen(false);
                  if (id !== activeId) selectMutation.mutate(id);
                }}
              >
                <OrgAvatar tenant={m.tenant} size="sm" />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                {tier && <span className="tm-sidebar-org-plan shrink-0">{tier}</span>}
              </button>
            );
          })}
          {memberships.length === 0 && !isLoading && (
            <p className="px-2.5 py-2 text-xs text-[var(--color-text-muted)]">No organizations yet</p>
          )}
          <div className="mt-0.5 border-t border-[var(--color-bg-border)] pt-0.5">
            <OrgSwitcherFooterActions onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
