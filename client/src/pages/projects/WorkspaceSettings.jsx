import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Settings, UserPlus, X, Briefcase } from 'lucide-react';
import NexusDropdown from '../../components/ui/NexusDropdown';
import RoleOptionBoxes from '../../components/ui/RoleOptionBoxes';
import WorkspaceColorPicker from '../../components/ui/WorkspaceColorPicker';
import { Badge, PageHeader, PageContainer, Card, Button, PageSkeleton } from '../../components/ui';
import { getDepartmentSlug, getDepartmentName, isAdminUser } from '../../utils/departmentPermissions';
import { suggestProjectRole } from '../../utils/taskText';
import { DEFAULT_WORKSPACE_COLOR, isValidHexColor, normalizeHexColor } from '../../utils/workspaceColors';
import { useAuth } from '../../contexts/AuthContext';
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';

const WorkspaceSettings = () => {
  const { name: nameParam } = useParams();
  const workspaceName = decodeURIComponent(nameParam || '').trim();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [workspaceColor, setWorkspaceColor] = useState(DEFAULT_WORKSPACE_COLOR);
  const [initialColor, setInitialColor] = useState(DEFAULT_WORKSPACE_COLOR);
  const [initialMembers, setInitialMembers] = useState([]);
  const [createdById, setCreatedById] = useState(null);

  const apiPath = `/api/projects/workspaces/${encodeURIComponent(workspaceName)}`;
  const isAdmin = isAdminUser(user);
  const canManageMembers = isAdmin || (createdById && user?._id && String(createdById) === String(user._id));
  const accentColor = normalizeHexColor(workspaceColor) || DEFAULT_WORKSPACE_COLOR;

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
      setInitialMembers(cloneSnapshot(defaults));
      setProjects(data.projects || []);
      const loadedColor = normalizeHexColor(data.color) || DEFAULT_WORKSPACE_COLOR;
      setWorkspaceColor(loadedColor);
      setInitialColor(loadedColor);
      setCreatedById(data.createdBy?._id || data.createdBy || null);
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
    const memberUser = users.find((u) => u._id === userId);
    if (memberUser && !members.find((m) => m.userId === memberUser._id)) {
      setMembers([
        ...members,
        {
          userId: memberUser._id,
          name: memberUser.name,
          profileRole: getDepartmentSlug(memberUser),
          projectRole: suggestProjectRole(getDepartmentSlug(memberUser)),
          avatar: memberUser.avatar,
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
    if (isAdmin && workspaceColor !== initialColor && !isValidHexColor(workspaceColor)) {
      alert('Enter a valid hex color (e.g. #3498db).');
      return;
    }
    setSaving(true);
    setForbidden(false);
    try {
      const payload = {
        defaultMembers: members.map((m) => ({ userId: m.userId, role: m.projectRole })),
      };
      if (isAdmin && workspaceColor !== initialColor) {
        payload.color = normalizeHexColor(workspaceColor);
      }
      await axios.patch(apiPath, payload);
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
    const optionUser = users.find((u) => u._id === value);
    if (!optionUser) return label;
    return (
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center text-[10px] font-black text-blue-500 overflow-hidden">
          {optionUser?.avatar ? (
            <img src={optionUser.avatar} className="w-full h-full object-cover" alt="" />
          ) : (
            optionUser?.name?.substring(0, 2).toUpperCase()
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-[var(--color-text-primary)] leading-none mb-0.5">
            {optionUser?.name}
          </span>
          <span className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">
            {getDepartmentName(optionUser)}
          </span>
        </div>
      </div>
    );
  };

  const membersSnapshot = useMemo(
    () => members.map((m) => ({ userId: String(m.userId), projectRole: m.projectRole })),
    [members]
  );
  const initialMembersSnapshot = useMemo(
    () => initialMembers.map((m) => ({ userId: String(m.userId), projectRole: m.projectRole })),
    [initialMembers]
  );
  const hasWorkspaceChanges =
    !stableJsonEqual(membersSnapshot, initialMembersSnapshot) ||
    (isAdmin && workspaceColor !== initialColor);

  useUnsavedChanges({
    hasChanges: hasWorkspaceChanges && !forbidden,
    onSave: handleSave,
    onCancel: () => {
      setMembers(cloneSnapshot(initialMembers));
      setWorkspaceColor(initialColor);
    },
    isSaving: saving,
  });

  const displayName = workspaceName.toUpperCase();

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
      <PageHeader
        title={`${displayName} Workspace`}
        icon={Settings}
        leadingActions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 shrink-0"
          >
            <ArrowLeft size={14} /> Back to Projects
          </Button>
        }
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

      <Card className="p-8 space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">
            Workspace Color
          </label>
          <div
            className="w-4 h-4 rounded-full shrink-0 border border-[var(--color-bg-border)]"
            style={{ backgroundColor: accentColor }}
            title="Current workspace color"
          />
        </div>
        <p className="text-xs text-[var(--color-text-muted)] -mt-2">
          Used across projects, task lists, badges, and dashboard cards for this workspace.
        </p>
        {isAdmin ? (
          <WorkspaceColorPicker
            value={workspaceColor}
            onChange={setWorkspaceColor}
            disabled={forbidden}
          />
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">
            Only admins can change workspace color.
          </p>
        )}
      </Card>

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
          disabled={!canManageMembers || forbidden}
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
                  disabled={!canManageMembers || forbidden}
                />
              </div>
              <button
                type="button"
                onClick={() => removeMember(m.userId)}
                disabled={!canManageMembers || forbidden}
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

    </PageContainer>
  );
};

export default WorkspaceSettings;
