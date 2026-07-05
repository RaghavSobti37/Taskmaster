import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/primitives';

export default function CreateOrganizationPage() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/tenants/create', { name }, { withCredentials: true });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-base)] p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] p-6">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Create your organization</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">CoreKnot works per organization. Name yours to get started.</p>
        <label className="mt-6 block text-xs font-medium text-[var(--color-text-muted)]" htmlFor="org-name">
          Organization name
        </label>
        <input
          id="org-name"
          className="mt-1 w-full rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={loading || !name.trim()}>
          {loading ? 'Creating…' : 'Create organization'}
        </Button>
      </form>
    </div>
  );
}
