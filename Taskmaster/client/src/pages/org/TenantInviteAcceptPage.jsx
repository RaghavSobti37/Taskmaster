import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/primitives';

export default function TenantInviteAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`/api/invites/${token}`, { withCredentials: true })
      .then((res) => setInvite(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Invalid invite'));
  }, [token]);

  const accept = async () => {
    if (!user) {
      navigate(`/login?redirect=/invites/${token}/accept`);
      return;
    }
    setLoading(true);
    try {
      await axios.post(`/api/invites/${token}/accept`, {}, { withCredentials: true });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!invite) {
    return <div className="flex min-h-screen items-center justify-center p-6 text-sm text-[var(--color-text-muted)]">Loading invite…</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] p-6 text-center">
        <h1 className="text-lg font-semibold">Join {invite.tenant?.name}</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          You were invited as <strong>{invite.role}</strong> ({invite.email})
        </p>
        <Button className="mt-6 w-full" onClick={accept} disabled={loading}>
          {loading ? 'Accepting…' : 'Accept invitation'}
        </Button>
      </div>
    </div>
  );
}
