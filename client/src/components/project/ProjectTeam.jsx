import React, { useState, useEffect } from 'react';
import { Briefcase, Mail, Circle, UserMinus } from 'lucide-react';
import { Badge, NexusModal, AddMembers } from '../ui';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { projectRoleLabel } from '../../constants/taskOptions';

const ProjectTeam = ({ project, onRemoveMember }) => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: directory = [] } = useUserDirectory();
  const [allTeams, setAllTeams] = useState([]);
  const [localMembers, setLocalMembers] = useState(project.members || []);
  const [removeModal, setRemoveModal] = useState({ open: false, member: null });
  const isAdmin = currentUser?.role === 'admin';
  const isOwner = project.owner?._id === currentUser?._id || project.owner === currentUser?._id;
  const memberRoles = project.memberRoles || [];

  const teamUsers = directory.map((m) => ({
    _id: m.user?._id || m._id,
    name: m.user?.name || m.name,
    email: m.user?.email || m.email,
    role: m.user?.role || m.role,
    avatar: m.user?.avatar || m.avatar,
  }));

  const getTeamColor = (teamName) => {
    const team = allTeams.find((t) => t.name === teamName);
    if (team?.color) return { borderLeft: `3px solid ${team.color}`, color: team.color };

    const colors = ['#3b82f6', '#a855f7', '#f97316', '#ec4899', '#06b6d4', '#10b981'];
    let hash = 0;
    if (!teamName) return { color: colors[0] };
    const name = teamName.toString();
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];
    return { borderLeft: `3px solid ${color}`, color };
  };

  const getMemberOnline = (member) => {
    if (typeof member?.user?.online === 'boolean') return member.user.online;
    if (typeof member?.online === 'boolean') return member.online;
    return false;
  };

  useEffect(() => {
    setLocalMembers(project.members || []);
  }, [project.members]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const teamsRes = await axios.get('/api/teams');
        setAllTeams(teamsRes.data);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };
    fetchData();
  }, []);

  const handleConfirmRemove = () => {
    if (removeModal.member && onRemoveMember) {
      onRemoveMember(removeModal.member._id);
      setLocalMembers((prev) => prev.filter((m) => m._id !== removeModal.member._id));
    }
    setRemoveModal({ open: false, member: null });
  };

  const canRemoveMember = (member) => {
    const ownerId = project.owner?._id || project.owner;
    if (member._id === ownerId) return false;
    return isAdmin || isOwner;
  };

  return (
    <div className="space-y-8">
      <NexusModal
        isOpen={removeModal.open}
        onClose={() => setRemoveModal({ open: false, member: null })}
        title="Remove Member"
        message={`Are you sure you want to remove ${removeModal.member?.name || 'this member'} from the project?`}
        type="danger"
        isConfirm
        confirmLabel="Remove"
        onConfirm={handleConfirmRemove}
      />

      {(isAdmin || isOwner) && (
        <AddMembers
          variant="picker"
          title="Add teammates"
          subtitle="Search and assign a project role"
          users={teamUsers}
          excludeIds={localMembers.map((m) => m._id)}
          onAdd={async (userId, role) => {
            await axios.post(`/api/projects/${project._id}/members`, { userId, role });
            queryClient.invalidateQueries({ queryKey: ['projects', project._id] });
            queryClient.invalidateQueries({ queryKey: ['projects'] });
          }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {localMembers.map((member) => {
          const roleEntry = memberRoles.find((r) => r.user?._id === member._id || r.user === member._id);
          const roleLabel = projectRoleLabel(roleEntry?.role || 'member');
          const isOnline = getMemberOnline(member);

          return (
            <div key={member._id} className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] p-6 shadow-sm hover:shadow-xl transition-all group relative">
              {canRemoveMember(member) && (
                <button
                  onClick={() => setRemoveModal({ open: true, member })}
                  className="absolute top-4 right-4 p-2 rounded-xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:text-red-500 hover:border-red-500/30 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <UserMinus size={16} />
                </button>
              )}

              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] overflow-hidden flex items-center justify-center font-black text-lg text-[var(--color-action-primary)]">
                    {member.avatar ? (
                      <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      member.name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--color-bg-surface)] ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-action-primary)] transition-colors truncate">{member.name}</h3>
                    <Badge variant="info">{roleLabel}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <Mail size={12} />
                    <span className="font-medium truncate">{member.email}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {member.teams?.length > 0 ? (
                  member.teams.map((t) => (
                    <span
                      key={t}
                      className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]"
                      style={getTeamColor(t)}
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-[9px] font-black uppercase text-[var(--color-text-muted)] flex items-center gap-1">
                    <Briefcase size={10} /> No teams
                  </span>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-[var(--color-bg-border)] flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Status</span>
                <div className="flex items-center gap-1.5">
                  <Circle size={8} className={isOnline ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'} />
                  <span className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">{isOnline ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectTeam;
