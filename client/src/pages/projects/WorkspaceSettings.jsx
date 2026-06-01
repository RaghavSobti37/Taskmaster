import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Settings, UserPlus, X, Briefcase } from 'lucide-react';
import NexusDropdown from '../../components/ui/NexusDropdown';
import RoleOptionBoxes from '../../components/ui/RoleOptionBoxes';
import { Badge, PageHeader, PageContainer, Card, Button, PageSkeleton } from '../../components/ui';
import { getDepartmentSlug, getDepartmentName } from '../../utils/departmentPermissions';
import { suggestProjectRole } from '../../utils/taskText';
import { getWorkspaceColor } from '../../utils/workspaceColors';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';

const WorkspaceSettings = () => {
  const { name: nameParam } = useParams();
  const workspaceName = decodeURIComponent(nameParam || '').trim();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: workspaces = [] } = useWorkspaces();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);

  const apiPath = `/api/projects/workspaces/${encodeURIComponent(workspaceName)}`;

  const loadWorkspace = useCallback(async () => {
    if (!workspaceName) {
      setError('Workspace name is required');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const { data } = await axios.get(apiPath);
      const defaults = (data.defaultMembers || []).map((entry) => {
        const u = entry.user;
        const userId = u?._id || entry.user;
        return {
          userId,
          name: u?.name || 'Unknown',
          profileRole: getDepartmentSlug(u || {}),
          projectRole: entry.role || 'member',
          avatar: u?.avatar,
        };
      }).filter((d) => d.userId);
      setMembers(defaults);
      setProjects(data.projects || []);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Workspace not found');
      } else {
        setError(err.response?.data?.error || 'Failed to load workspace');
      }
    } finally {
      setLoading(false);
    }
  }, [apiPath, workspaceName]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get('/api/users/team');
        setUsers(res.data.team || []);
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };
    fetchUsers();
  }, []);

  const addMember = (userId) => {
    const user = users.find((u) => u._id === userId);
    if (user && !members.find((m) => m.userId === user._id)) {
      setMembers([
        ...members,
        {
          userId: user._id,
          name: user.name,
          profileRole: getDepartmentSlug(user),
          projectRole: suggestProjectRole(getDepartmentSlug(user)),
          avatar: user.avatar,
        },
      ]);
    }
  };

  const updateMemberRole = (userId, projectRole) => {
    setMembers(members.map((m) => (m.userId === userId ? { ...m, projectRole } : m)));
  };

  const removeMember = (userId) => {
    setMembers(members.filter((m) => m.userId !== userId));
  };

  const handleSave = async () => {
    setSaving(true);
    setForbidden(false);
    try {
      await axios.patch(apiPath, {
        defaultMembers: members.map((m) => ({ userId: m.userId, role: m.projectRole })),
      });
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
    } catch (err) {
      if (err.response?.status === 403) {
        setForbidden(true);
      } else {
        alert(err.response?.data?.error || 'Failed to save workspace settings');
      }
    } finally {
      setSaving(false);
    }
  };

  const formatOptionLabel = ({ value, label }) => {
    const user = users.find((u) => u._id === value);
    if (!user) return label;
    return (
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center text-[10px] font-black text-blue-500 overflow-hidden">
          {user?.avatar ? (
            <img src={user.avatar} className="w-full h-full object-cover" alt="" />
          ) : (
            user?.name?.substring(0, 2).toUpperCase()
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-[var(--color-text-primary)] leading-none mb-0.5">
            {user?.name}
          </span>
          <span className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">
            {getDepartmentName(user)}
          </span>
        </div>
      </div>
    );
  };

  const displayName = workspaceName.toUpperCase();
  const accentColor = getWorkspaceColor(displayName, workspaces);

  if (loading) {
    return (
      <PageContainer maxWidth="1000px">
        <PageSkeleton />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="1000px">
        <Button variant="ghost" size="xs" onClick={() => navigate('/projects')} className="mb-4 flex items-center gap-2">
          <ArrowLeft size={14} /> Back to Projects
        </Button>
        <Card className="p-8 text-center">
          <p className="text-sm font-bold text-red-400">{error}</p>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="1000px">
      <Button
        variant="ghost"
        size="xs"
        onClick={() => navigate('/projects')}
        className="mb-4 flex items-center gap-2"
      >
        <ArrowLeft size={14} /> Back to Projects
      </Button>

      <PageHeader
        title={`${displayName} Workspace`}
        subtitle="Default members are added to new projects and synced to existing projects in this workspace."
        icon={Settings}
        actions={
          <div
            className="w-3 h-3 rounded-full shrink-0 border border-[var(--color-bg-border)]"
            style={{ backgroundColor: accentColor }}
            title="Workspace color"
          />
        }
      />

      {forbidden && (
        <Card className="p-4 mb-4 border-red-500/30 bg-red-500/5">
          <p className="text-sm font-bold text-red-400">
            Not authorized to update this workspace. Contact an admin or the workspace creator.
          </p>
        </Card>
      )}

      <Card className="p-8 space-y-6 mb-6">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">
            Default Members
          </label>
          <Badge variant="todo">{members.length} configured</Badge>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] -mt-2">
          These members are pre-filled when creating a project in this workspace. Saving updates membership on
          existing projects (except project owners).
        </p>

        <NexusDropdown
          options={users.map((u) => ({ value: u._id, label: u.name }))}
          value=""
          onChange={addMember}
          placeholder="Search team members..."
          renderOption={formatOptionLabel}
          searchable
          disabled={forbidden}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center justify-between p-3 bg-[var(--color-bg-workspace)] rounded-xl border border-[var(--color-bg-border)] group gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] flex items-center justify-center font-black text-[10px] text-blue-500 uppercase overflow-hidden">
                  {m.avatar ? (
                    <img src={m.avatar} className="w-full h-full object-cover" alt="" />
                  ) : (
                    m.name.substring(0, 2)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-xs uppercase tracking-tight text-[var(--color-text-primary)] truncate">
                    {m.name}
                  </p>
                  <p className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-[0.2em]">
                    Profile: {m.profileRole || 'user'}
                  </p>
                </div>
              </div>
              <div className="w-full sm:min-w-[14rem] sm:max-w-[16rem] shrink-0">
                <RoleOptionBoxes
                  value={m.projectRole}
                  onChange={(role) => updateMemberRole(m.userId, role)}
                  label=""
                  disabled={forbidden}
                />
              </div>
              <button
                type="button"
                onClick={() => removeMember(m.userId)}
                disabled={forbidden}
                className="p-1.5 hover:text-red-500 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0 disabled:opacity-30"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {members.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-2xl opacity-30">
              <UserPlus size={32} className="mx-auto text-[var(--color-text-muted)] mb-3" />
              <p className="text-[10px] font-black uppercase tracking-widest">No Default Members</p>
            </div>
          )}
        </div>
      </Card>

      {projects.length > 0 && (
        <Card className="p-8 space-y-4 mb-6">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-[var(--color-text-muted)]" />
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
              Projects in workspace
            </label>
            <Badge variant="info">{projects.length}</Badge>
          </div>
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p._id}>
                <Link
                  to={`/projects/${p._id}`}
                  className="text-sm font-bold text-[var(--color-action-primary)] hover:underline uppercase tracking-tight"
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface)] transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || forbidden}
          className="bg-[var(--color-action-primary)] text-white px-10 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
        >
          {saving ? 'Saving...' : 'Save Defaults'}
        </button>
      </div>
    </PageContainer>
  );
};

export default WorkspaceSettings;
