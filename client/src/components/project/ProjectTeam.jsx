import React, { useState, useEffect } from 'react';
import { Briefcase, Mail, Circle, UserMinus, Users, ClipboardList } from 'lucide-react';
import { Badge, AddMembers, EmptyState, NexusDropdown, Button } from '../ui';
import { NexusModal } from '../ui/modals';;
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { projectRoleLabel, PROJECT_ROLE_OPTIONS, normalizeProjectRoleValue } from '../../constants/taskOptions';

const ProjectTeam = ({ project, onRemoveMember }) => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: directory = [] } = useUserDirectory();
  const [allTeams, setAllTeams] = useState([]);
  const [localMembers, setLocalMembers] = useState(project.members || []);
  const [localMemberRoles, setLocalMemberRoles] = useState(project.memberRoles || []);
  const [removeModal, setRemoveModal] = useState({ open: false, member: null });
  const [kraModal, setKraModal] = useState({ open: false, member: null, closed: '', moved: '' });
  const [kraSaving, setKraSaving] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState(null);
  const isAdmin = isAdminUser(currentUser);
  const isOwner = project.owner?._id === currentUser?._id || project.owner === currentUser?._id;
  const canManageTeam = isAdmin || isOwner;
  const ownerId = project.owner?._id || project.owner;

  const { data: kraRows = [] } = useQuery({
    queryKey: ['projects', project._id, 'kra'],
    queryFn: async () => (await axios.get(`/api/projects/${project._id}/kra`)).data,
    enabled: !!project._id,
  });

  const kraByUserId = React.useMemo(() => {
    const map = new Map();
    for (const row of kraRows) {
      const uid = row.userId?._id || row.userId;
      if (uid) map.set(String(uid), row);
    }
    return map;
  }, [kraRows]);

  const teamUsers = directory.map((m) => ({
    _id: m.user?._id || m._id,
    name: m.user?.name || m.name,
    email: m.user?.email || m.email,
    departmentId: m.user?.departmentId || m.departmentId,
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
    setLocalMemberRoles(project.memberRoles || []);
  }, [project.members, project.memberRoles]);

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
    if (member._id === ownerId) return false;
    return canManageTeam;
  };

  const canEditMemberRole = (member) => {
    if (member._id === ownerId) return false;
    return canManageTeam;
  };

  const getMemberRole = (memberId) => {
    const roleEntry = localMemberRoles.find((r) => r.user?._id === memberId || r.user === memberId);
    return normalizeProjectRoleValue(roleEntry?.role || 'member');
  };

  const handleRoleChange = async (memberId, role) => {
    const previousRoles = localMemberRoles;
    setRoleUpdating(memberId);
    setLocalMemberRoles((prev) => {
      const next = [...prev];
      const idx = next.findIndex((r) => r.user?._id === memberId || r.user === memberId);
      if (idx >= 0) next[idx] = { ...next[idx], role };
      else next.push({ user: memberId, role });
      return next;
    });

    try {
      await axios.patch(`/api/projects/${project._id}/members/${memberId}/role`, { role });
      queryClient.invalidateQueries({ queryKey: ['projects', project._id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err) {
      console.error('Error updating member role:', err);
      setLocalMemberRoles(previousRoles);
    } finally {
      setRoleUpdating(null);
    }
  };

  const onlineCount = localMembers.filter((m) => getMemberOnline(m)).length;

  const openKraModal = (member) => {
    const row = kraByUserId.get(String(member._id));
    setKraModal({
      open: true,
      member,
      closed: row?.closed || '',
      moved: row?.moved || '',
    });
  };

  const canViewKra = (member) => {
    if (canManageTeam) return true;
    return member._id === currentUser?._id;
  };

  const handleSaveKra = async () => {
    if (!kraModal.member) return;
    setKraSaving(true);
    try {
      await axios.put(`/api/projects/${project._id}/kra/${kraModal.member._id}`, {
        closed: kraModal.closed,
        moved: kraModal.moved,
      });
      queryClient.invalidateQueries({ queryKey: ['projects', project._id, 'kra'] });
      setKraModal({ open: false, member: null, closed: '', moved: '' });
    } catch (err) {
      console.error('KRA save failed', err);
    } finally {
      setKraSaving(false);
    }
  };

  return (
    <div className="p-4">
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

      {kraModal.open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest">
              KRA — {kraModal.member?.name}
            </h3>
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase text-emerald-400">Closed</span>
                <textarea
                  className="w-full min-h-[80px] text-sm rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-2"
                  value={kraModal.closed}
                  onChange={(e) => setKraModal((s) => ({ ...s, closed: e.target.value }))}
                  readOnly={!canManageTeam}
                  placeholder="What we have closed…"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase text-blue-400">Moved</span>
                <textarea
                  className="w-full min-h-[80px] text-sm rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-2"
                  value={kraModal.moved}
                  onChange={(e) => setKraModal((s) => ({ ...s, moved: e.target.value }))}
                  readOnly={!canManageTeam}
                  placeholder="What we have moved…"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setKraModal({ open: false, member: null, closed: '', moved: '' })}>
                Close
              </Button>
              {canManageTeam && (
                <Button size="sm" disabled={kraSaving} onClick={handleSaveKra}>Save KRA</Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-primary)]">
                Project team
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {localMembers.length} member{localMembers.length === 1 ? '' : 's'}
                {localMembers.length > 0 && (
                  <span className="text-[var(--color-text-muted)]">
                    {' · '}
                    <Circle size={8} className="inline fill-green-500 text-green-500 -mt-0.5" />
                    {' '}
                    {onlineCount} online
                  </span>
                )}
              </p>
            </div>
          </div>

          {localMembers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No team members yet"
              description={canManageTeam ? 'Search and add teammates using the panel below.' : 'Team members will appear here once they are added.'}
              variant="dashed"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {localMembers.map((member) => {
                const roleValue = getMemberRole(member._id);
                const roleLabel = projectRoleLabel(roleValue);
                const isOnline = getMemberOnline(member);
                const editableRole = canEditMemberRole(member);

                return (
                  <div
                    key={member._id}
                    className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] p-4 transition-colors hover:bg-[var(--color-bg-secondary)]/30 group relative"
                  >
                    {canRemoveMember(member) && (
                      <button
                        type="button"
                        onClick={() => setRemoveModal({ open: true, member })}
                        className="absolute top-3 right-3 p-1.5 rounded-lg bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:text-red-500 hover:border-red-500/30 opacity-0 group-hover:opacity-100 transition-all"
                        aria-label={`Remove ${member.name}`}
                      >
                        <UserMinus size={14} />
                      </button>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] overflow-hidden flex items-center justify-center font-black text-sm text-[var(--color-action-primary)]">
                          {member.avatar ? (
                            <img src={member.avatar} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          ) : (
                            member.name.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-bg-surface)] ${
                            isOnline ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <h3 className="font-bold text-sm text-[var(--color-text-primary)] truncate">{member.name}</h3>
                          {editableRole ? (
                            <div className="w-[5.5rem] shrink-0">
                              <NexusDropdown
                                options={PROJECT_ROLE_OPTIONS}
                                value={roleValue}
                                onChange={(role) => handleRoleChange(member._id, role)}
                                disabled={roleUpdating === member._id}
                                variant="compact"
                                className="text-[10px] font-black uppercase"
                              />
                            </div>
                          ) : (
                            <Badge variant="info">{roleLabel}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                          <Mail size={11} className="shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {canViewKra(member) && (
                            <button
                              type="button"
                              onClick={() => openKraModal(member)}
                              className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-blue-400 hover:border-blue-400/40 flex items-center gap-1"
                            >
                              <ClipboardList size={9} /> KRA
                            </button>
                          )}
                          <span className="text-[9px] font-black uppercase text-[var(--color-text-muted)] flex items-center gap-1">
                            <Circle size={6} className={isOnline ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'} />
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                          {member.teams?.length > 0 ? (
                            member.teams.map((t) => (
                              <span
                                key={t}
                                className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]"
                                style={getTeamColor(t)}
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-[9px] font-black uppercase text-[var(--color-text-muted)] flex items-center gap-1">
                              <Briefcase size={9} /> No teams
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {canManageTeam && (
          <AddMembers
            variant="picker"
            title="Add teammates"
            subtitle="Search and assign a project role"
            users={teamUsers}
            excludeIds={localMembers.map((m) => m._id)}
            className="w-full lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-4 max-w-none"
            onAdd={async (userId, role) => {
              await axios.post(`/api/projects/${project._id}/members`, { userId, role });
              queryClient.invalidateQueries({ queryKey: ['projects', project._id] });
              queryClient.invalidateQueries({ queryKey: ['projects'] });
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ProjectTeam;
