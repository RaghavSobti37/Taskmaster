import React, { useState } from 'react';
import { UserPlus, Loader2, Trash2 } from 'lucide-react';
import { Card, Badge, Button } from '../../../components/ui';
import {
  useArtistMemberships,
  useInviteArtistMembership,
  useUpdateArtistMembership,
  useRemoveArtistMembership,
} from '../../../hooks/queries/artistMembers';
import {
  ARTIST_MEMBERSHIP_ROLES,
  ROLE_LABELS,
  hasArtistPermission,
} from '../../../utils/artistMemberPermissions';
import ArtistInviteMemberModal from '../../../components/artists/ArtistInviteMemberModal';

const STATUS_VARIANT = {
  accepted: 'success',
  pending: 'warning',
  revoked: 'rose',
};

export default function ArtistTeamTab({ artistId, membership, canManageTeam = false }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const { data: members = [], isLoading } = useArtistMemberships(artistId, !!artistId);
  const inviteMutation = useInviteArtistMembership();
  const updateMutation = useUpdateArtistMembership();
  const removeMutation = useRemoveArtistMembership();

  const manageAllowed = canManageTeam || hasArtistPermission(membership, 'team');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)]">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const list = members.length
    ? members
    : (membership?.fallback
      ? [{
        _id: membership._id || 'fallback-self',
        role: membership.role,
        status: 'accepted',
        user: { name: 'You' },
        legacy: true,
      }]
      : []);

  const handleRoleChange = async (member, role) => {
    if (member.legacy || !member._id || member._id === 'fallback-self') return;
    await updateMutation.mutateAsync({ artistId, membershipId: member._id, data: { role } });
  };

  const handleRemove = async (member) => {
    if (member.legacy || !member._id) return;
    if (!window.confirm('Remove this team member?')) return;
    await removeMutation.mutateAsync({ artistId, membershipId: member._id });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 rounded-xl border border-[var(--color-bg-border)]">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-black text-[var(--color-text-primary)]">Team members</h3>
          {manageAllowed && (
            <Button size="sm" variant="secondary" onClick={() => setInviteOpen(true)}>
              <UserPlus size={14} /> Invite
            </Button>
          )}
        </div>

        {list.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">No team members yet.</p>
        ) : (
          <div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)]">
                  <th className="py-2 pr-3 font-bold">Member</th>
                  <th className="py-2 pr-3 font-bold">Role</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  {manageAllowed && <th className="py-2 font-bold w-16" />}
                </tr>
              </thead>
              <tbody>
                {list.map((m) => {
                  const name = m.user?.name || m.user?.email || m.email || 'Member';
                  const status = m.status || (m.acceptedAt ? 'accepted' : 'pending');
                  return (
                    <tr key={m._id} className="border-b border-[var(--color-bg-border)] last:border-0">
                      <td className="py-2.5 pr-3 font-bold text-[var(--color-text-primary)]">{name}</td>
                      <td className="py-2.5 pr-3">
                        {manageAllowed && !m.legacy && m.role !== 'artist-owner' ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m, e.target.value)}
                            className="text-xs min-w-[8rem] rounded-lg border border-[var(--color-bg-border)] bg-[var(--token-surface-1)] px-2 py-1"
                            disabled={updateMutation.isPending}
                          >
                            {ARTIST_MEMBERSHIP_ROLES.filter((r) => r !== 'artist-owner').map((role) => (
                              <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant="slate">{ROLE_LABELS[m.role] || m.role}</Badge>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={STATUS_VARIANT[status] || 'slate'}>{status}</Badge>
                      </td>
                      {manageAllowed && (
                        <td className="py-2.5 text-right">
                          {!m.legacy && m.role !== 'artist-owner' && (
                            <button
                              type="button"
                              onClick={() => handleRemove(m)}
                              disabled={removeMutation.isPending}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"
                              aria-label={`Remove ${name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ArtistInviteMemberModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        isPending={inviteMutation.isPending}
        onInvite={async (payload) => {
          await inviteMutation.mutateAsync({ artistId, data: payload });
          setInviteOpen(false);
        }}
      />
    </div>
  );
}
