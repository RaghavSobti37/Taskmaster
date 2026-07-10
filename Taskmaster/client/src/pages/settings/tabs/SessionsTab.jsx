import React, { useCallback, useState } from 'react';
import axios from 'axios';
import { Monitor, Shield, LogOut, RefreshCw } from 'lucide-react';
import RelativeTimestamp from '../../../components/ui/RelativeTimestamp';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Badge } from '../../../components/ui';
import QueryErrorSlot from '../../../components/ui/QueryErrorSlot';
import { globalConfirm } from '../../../contexts/confirmContext';
import { useAuth } from '../../../contexts/AuthContext';

const SessionsTab = () => {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [busyJti, setBusyJti] = useState(null);

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: async () => {
      const { data: res } = await axios.get('/api/auth/sessions');
      return res.sessions || [];
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (jti) => axios.delete(`/api/auth/sessions/${jti}`),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      if (res.data?.revokedCurrent) {
        await logout();
        window.location.href = '/login';
      }
    },
    onSettled: () => setBusyJti(null),
  });

  const revokeOthersMutation = useMutation({
    mutationFn: () => axios.post('/api/auth/sessions/revoke-others'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });

  const handleRevoke = useCallback(async (session) => {
    const ok = await globalConfirm.confirm({
      title: session.current ? 'Sign out this device?' : 'Revoke session?',
      message: session.current
        ? 'You will be signed out on this device.'
        : `Revoke ${session.label || 'this session'}?`,
      confirmLabel: session.current ? 'Sign out' : 'Revoke',
      type: 'warning',
    });
    if (!ok) return;
    setBusyJti(session.jti);
    revokeMutation.mutate(session.jti);
  }, [revokeMutation]);

  const handleRevokeOthers = useCallback(async () => {
    const others = (data || []).filter((s) => !s.current);
    if (!others.length) return;
    const ok = await globalConfirm.confirm({
      title: 'Sign out other devices?',
      message: `Revoke ${others.length} other session${others.length === 1 ? '' : 's'}.`,
      confirmLabel: 'Revoke all',
      type: 'warning',
    });
    if (!ok) return;
    revokeOthersMutation.mutate();
  }, [data, revokeOthersMutation]);

  const sessions = data || [];
  const otherCount = sessions.filter((s) => !s.current).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <QueryErrorSlot
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        fallback="Failed to load active sessions"
      />
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-brand-teal)] mb-2">
            <Shield size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Security</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Active sessions</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Devices signed in to your account. Revoke any session you do not recognize.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-lg border border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          aria-label="Refresh sessions"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {otherCount > 0 && (
        <div className="mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleRevokeOthers}
            disabled={revokeOthersMutation.isPending}
            className="gap-2"
          >
            <LogOut size={16} />
            Sign out other devices ({otherCount})
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No active sessions recorded yet. Sign in again to register this device.</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li
              key={session.jti}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] shrink-0">
                  <Monitor size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-[var(--color-text-primary)] truncate">
                      {session.label || 'Unknown device'}
                    </span>
                    {session.current && (
                      <Badge variant="success" className="text-[10px] uppercase">This device</Badge>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Last active <RelativeTimestamp value={session.lastSeenAt} />
                  </p>
                  {session.ip ? (
                    <p className="text-xs text-[var(--color-text-muted)]">IP {session.ip}</p>
                  ) : session.current ? (
                    <p className="text-xs text-[var(--color-text-muted)]">Local device</p>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant={session.current ? 'outline' : 'danger'}
                size="sm"
                onClick={() => handleRevoke(session)}
                disabled={busyJti === session.jti}
                className="shrink-0"
              >
                {session.current ? 'Sign out' : 'Revoke'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SessionsTab;
