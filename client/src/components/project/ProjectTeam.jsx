import React, { useState, useEffect } from 'react';
import { Briefcase, Mail, Circle, Plus, UserMinus } from 'lucide-react';
import { Badge, NexusModal } from '../ui';
import CKDropdown from '../ui/CKDropdown';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const ProjectTeam = ({ project, onRemoveMember }) => {
  const { user: currentUser } = useAuth();
  const [allTeams, setAllTeams] = useState([]);
  const [localMembers, setLocalMembers] = useState(project.members || []);
  const [removeModal, setRemoveModal] = useState({ open: false, member: null });
  const isAdmin = currentUser?.role === 'admin';
  const isOwner = project.owner?._id === currentUser?._id || project.owner === currentUser?._id;

  const getTeamColor = (teamName) => {
    const team = allTeams.find(t => t.name === teamName);
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

  const handleUpdateTeams = async (userId, teams) => {
    try {
      await axios.put(`/api/users/${userId}/teams`, { teams });
      setLocalMembers(prev => prev.map(m => m._id === userId ? { ...m, teams } : m));
    } catch (err) {
      console.error('Error updating user teams:', err);
    }
  };

  const teamOptions = allTeams.map(t => ({ value: t.name, label: t.name.toUpperCase() }));
  const memberRoles = project.memberRoles || [];

  const handleConfirmRemove = () => {
    if (removeModal.member && onRemoveMember) {
      onRemoveMember(removeModal.member._id);
      setLocalMembers(prev => prev.filter(m => m._id !== removeModal.member._id));
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--color-bg-workspace)] p-4 rounded-2xl border border-[var(--color-bg-border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <Plus size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-primary)]">Add Members</h3>
              <p className="text-[8px] font-black uppercase text-[var(--color-text-muted)]">Add new members to this project</p>
            </div>
          </div>
          <div className="w-full md:w-80">
            <AddMemberDropdown onAdd={async (userId) => {
              try {
                await axios.post(`/api/projects/${project._id}/members`, { userId });
                window.location.reload();
              } catch (err) {
                console.error('Error adding member:', err);
              }
            }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {localMembers.map((member) => {
          const roleEntry = memberRoles.find(r => r.user?._id === member._id || r.user === member._id);
          const roleLabel = roleEntry ? roleEntry.role : 'Member';
          const isOnline = getMemberOnline(member);
          
          return (
            <div key={member._id} className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] p-6 shadow-sm hover:shadow-xl transition-all group relative">
              {canRemoveMember(member) && (
                <button
                  onClick={() => setRemoveModal({ open: true, member })}
                  className="absolute top-4 right-4 p-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
                  title="Remove from project"
                >
                  <UserMinus size={14} />
                </button>
              )}

              <div className="flex items-start justify-between mb-6 pr-10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] flex items-center justify-center font-black text-xl text-[var(--color-action-primary)] overflow-hidden relative">
                    {member.avatar ? (
                      <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      member.name.substring(0, 2).toUpperCase()
                    )}
                    {isOnline && (
                      <div className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-[var(--color-bg-surface)] shadow-sm" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-action-primary)] transition-colors">{member.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={roleLabel === 'owner' ? 'progress' : 'todo'}>{roleLabel.toUpperCase()}</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-workspace)]/50 p-2 rounded-xl border border-[var(--color-bg-border)]/50">
                  <Mail size={14} className="text-[var(--color-text-muted)]" />
                  <span className="font-medium truncate">{member.email}</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} className="text-[var(--color-text-muted)]" />
                    <span className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Teams</span>
                  </div>
                  
                  {isAdmin ? (
                    <CKDropdown 
                      multi
                      placeholder="Assign Teams..."
                      options={teamOptions}
                      value={member.teams || []}
                      onChange={(teams) => handleUpdateTeams(member._id, teams)}
                      className="w-full"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {member.teams?.length > 0 ? (
                        member.teams.map(t => (
                          <span 
                            key={t} 
                            className="px-2.5 py-1 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] text-[9px] font-black uppercase tracking-widest transition-all"
                            style={getTeamColor(t)}
                          >
                            {t.toUpperCase()}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-[var(--color-text-muted)] font-bold italic">No team yet</span>
                      )}
                    </div>
                  )}
                </div>
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

import Select from 'react-select';

const AddMemberDropdown = ({ onAdd }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get('/api/users/team');
        setUsers(res.data.team || []);
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const formatOptionLabel = ({ value, label }) => {
    const user = users.find(u => u._id === value);
    if (!user) return label;
    return (
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center text-[10px] font-black text-blue-500 overflow-hidden">
          {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="" /> : user.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-[var(--color-text-primary)] leading-none mb-0.5">{user.name}</span>
          <span className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">{user.role}</span>
        </div>
      </div>
    );
  };

  return (
    <Select
      isLoading={loading}
      options={users.map(u => ({ value: u._id, label: u.name }))}
      onChange={(opt) => onAdd(opt.value)}
      placeholder="Select member..."
      formatOptionLabel={formatOptionLabel}
      menuPortalTarget={document.body}
      className="react-select-container"
      classNamePrefix="react-select"
      styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
    />
  );
};

export default ProjectTeam;
