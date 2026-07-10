import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Input } from '../ui';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from '../ui/modals';
import { ARTIST_MEMBERSHIP_ROLES, ROLE_LABELS } from '../../utils/artistMemberPermissions';

export default function ArtistInviteMemberModal({ isOpen, onClose, onInvite, isPending }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('artist-assistant');
  const [error, setError] = useState('');

  const reset = () => {
    setEmail('');
    setRole('artist-assistant');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onInvite({ email: email.trim(), role });
      reset();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invite failed');
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        <ModalHeader title="Invite team member" onClose={handleClose} />
        <ModalBody className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="colleague@example.com"
          />
          <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-bg-border)] bg-[var(--token-surface-1)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]"
            >
              {ARTIST_MEMBERSHIP_ROLES.filter((r) => r !== 'artist-owner').map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </label>
          {error && <p className="text-xs text-rose-500">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button type="submit" disabled={isPending || !email.trim()}>
            {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Send invite
          </Button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
}
