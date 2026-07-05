import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ChevronDown, Building2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const fetchMemberships = async () => {
  const { data } = await axios.get('/api/tenants/memberships', { withCredentials: true });
  return data;
};

export default function OrgSwitcher() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({
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

  const memberships = data?.memberships || [];
  const activeId = String(data?.activeTenantId || '');
  const active = memberships.find((m) => String(m.tenant?._id || m.tenant) === activeId);

  if (!memberships.length) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-[var(--color-bg-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]"
        aria-expanded={open}
      >
        <Building2 size={14} aria-hidden />
        <span className="max-w-[140px] truncate">{active?.tenant?.name || 'Organization'}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[200px] rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] p-1 shadow-lg">
          {memberships.map((m) => {
            const id = String(m.tenant?._id || m.tenant);
            return (
              <button
                key={m.id}
                type="button"
                className={`flex w-full items-center rounded-md px-3 py-2 text-left text-xs hover:bg-[var(--color-bg-elevated)] ${id === activeId ? 'font-semibold text-[var(--color-action-primary)]' : ''}`}
                onClick={() => {
                  setOpen(false);
                  if (id !== activeId) selectMutation.mutate(id);
                }}
              >
                {m.tenant?.name || 'Organization'}
              </button>
            );
          })}
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-[var(--color-action-primary)] hover:bg-[var(--color-bg-elevated)]"
            onClick={() => {
              setOpen(false);
              navigate('/org/create');
            }}
          >
            <Plus size={14} aria-hidden />
            Create organization
          </button>
        </div>
      )}
    </div>
  );
}
