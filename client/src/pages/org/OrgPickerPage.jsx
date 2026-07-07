import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { onOrgSwitch } from '../../lib/tenantClientCache';
import { orgPath, isOrgSlugRoutesEnabled, orgPathFromUser } from '../../lib/orgPaths';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/primitives';
import {
  clerkOrgSelectionUrl,
  isOrgFirstAuthEnabled,
  loadOrgFirstAuthConfig,
} from '../../lib/orgFirstAuth';

const fetchMemberships = async () => {
  const { data } = await axios.get('/api/tenants/memberships', { withCredentials: true });
  return data;
};

export default function OrgPickerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [configReady, setConfigReady] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['tenantMemberships'], queryFn: fetchMemberships });

  useEffect(() => {
    void loadOrgFirstAuthConfig().then(() => setConfigReady(true));
  }, []);

  useEffect(() => {
    if (!configReady) return;
    if (isOrgFirstAuthEnabled()) {
      window.location.assign(clerkOrgSelectionUrl());
    }
  }, [configReady]);

  const memberships = data?.memberships || [];

  const selectMutation = useMutation({
    mutationFn: async (tenantId) => {
      await axios.post('/api/tenants/select', { tenantId }, { withCredentials: true });
      return tenantId;
    },
    onSuccess: async (tenantId) => {
      const membership = memberships.find((m) => String(m.tenant?._id || m.tenant) === String(tenantId));
      const slug = membership?.tenant?.slug;
      await onOrgSwitch(queryClient);
      if (slug && isOrgSlugRoutesEnabled()) {
        window.location.assign(orgPath(slug, '/dashboard'));
      } else {
        window.location.assign('/dashboard');
      }
    },
  });

  if (!configReady || isOrgFirstAuthEnabled()) {
    return null;
  }

  if (!isLoading && memberships.length <= 1) {
    navigate(orgPathFromUser(user, '/dashboard'), { replace: true });
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-base)] p-6">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] p-6">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Choose organization</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Select which organization to open.</p>
        <ul className="mt-6 space-y-2">
          {memberships.map((m) => {
            const id = String(m.tenant?._id || m.tenant);
            return (
              <li key={m.id}>
                <Button
                  className="w-full justify-start"
                  variant="secondary"
                  onClick={() => selectMutation.mutate(id)}
                  disabled={selectMutation.isPending}
                >
                  {m.tenant?.name || 'Organization'}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
