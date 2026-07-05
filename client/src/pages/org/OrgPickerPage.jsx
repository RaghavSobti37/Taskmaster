import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/primitives';

const fetchMemberships = async () => {
  const { data } = await axios.get('/api/tenants/memberships', { withCredentials: true });
  return data;
};

export default function OrgPickerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['tenantMemberships'], queryFn: fetchMemberships });

  const selectMutation = useMutation({
    mutationFn: async (tenantId) => {
      await axios.post('/api/tenants/select', { tenantId }, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.clear();
      navigate('/dashboard', { replace: true });
    },
  });

  const memberships = data?.memberships || [];

  if (!isLoading && memberships.length <= 1) {
    navigate('/dashboard', { replace: true });
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
