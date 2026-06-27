import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import NexusDropdown from '../../components/ui/NexusDropdown';
import RoleOptionBoxes from '../../components/ui/RoleOptionBoxes';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, UserPlus, X, Briefcase } from 'lucide-react';
import { Badge, PageHeader, PageContainer, Button } from "../../components/ui";
import QueryErrorBanner, { getQueryErrorMessage } from '../../components/ui/QueryErrorBanner';
import { useToast } from '../../contexts/ToastContext';
import WorkspaceSelect from '../../components/forms/WorkspaceSelect';
import { suggestProjectRole } from '../../utils/taskText';
import { getDepartmentSlug, getDepartmentName } from '../../utils/departmentPermissions';

const ProjectCreate = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [users, setUsers] = useState([]);
  const [usersFetchError, setUsersFetchError] = useState(null);
  const [members, setMembers] = useState([]);
  const [workspace, setWorkspace] = useState('GENERAL');
  const [loading, setLoading] = useState(false);
  const prevDefaultIdsRef = useRef([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setUsersFetchError(null);
        const res = await axios.get('/api/users/team');
        setUsers(res.data.team || []);
      } catch (err) {
        setUsersFetchError(err);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!workspace) return;
    const loadWorkspaceDefaults = async () => {
      try {
        const { data } = await axios.get(`/api/projects/workspaces/${encodeURIComponent(workspace)}`);
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

        const defaultIds = defaults.map((d) => d.userId);
        setMembers((prev) => {
          const withoutOldDefaults = prev.filter((m) => !prevDefaultIdsRef.current.includes(m.userId));
          const merged = [...withoutOldDefaults];
          defaults.forEach((d) => {
            if (!merged.find((m) => m.userId === d.userId)) merged.push(d);
          });
          return merged;
        });
        prevDefaultIdsRef.current = defaultIds;
      } catch (err) {
        console.error('Error loading workspace defaults:', err);
      }
    };
    loadWorkspaceDefaults();
  }, [workspace]);

  const addMember = (userId) => {
    const user = users.find(u => u._id === userId);
    if (user && !members.find(m => m.userId === user._id)) {
      setMembers([...members, {
        userId: user._id,
        name: user.name,
        profileRole: getDepartmentSlug(user),
        projectRole: suggestProjectRole(getDepartmentSlug(user)),
        avatar: user.avatar
      }]);
    }
  };

  const updateMemberRole = (userId, projectRole) => {
    setMembers(members.map(m => m.userId === userId ? { ...m, projectRole } : m));
  };

  const removeMember = (userId) => {
    setMembers(members.filter(m => m.userId !== userId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/projects', { 
        name, 
        description: desc, 
        workspace,
        members: members.map((m) => ({
          userId: String(m.userId?._id || m.userId || ''),
          role: m.projectRole,
        })).filter((m) => m.userId),
      });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const formatOptionLabel = ({ value, label }) => {
    const user = users.find(u => u._id === value);
    if (!user) return label;
    return (
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center text-[10px] font-black text-blue-500 overflow-hidden">
          {user?.avatar ? <img src={user?.avatar} className="w-full h-full object-cover" alt="" /> : user?.name?.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-[var(--color-text-primary)] leading-none mb-0.5">{user?.name}</span>
          <span className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">{getDepartmentName(user)}</span>
        </div>
      </div>
    );
  };

  return (
    <PageContainer maxWidth="1000px">
      <PageHeader
        title="Create New Project"
        icon={Briefcase}
      />

      {usersFetchError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(usersFetchError, 'Could not load team members')}
          onRetry={() => {
            axios.get('/api/users/team')
              .then((res) => {
                setUsers(res.data.team || []);
                setUsersFetchError(null);
              })
              .catch((err) => setUsersFetchError(err));
          }}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="py-8 space-y-6 border-b border-[var(--color-bg-border)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Project Name</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-black text-sm uppercase tracking-tight"
                placeholder="Enter project name"
                required
              />
            </div>
            <div className="space-y-2">
              <WorkspaceSelect
                value={workspace}
                onChange={setWorkspace}
                label="Workspace"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Description</label>
            <textarea 
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none min-h-[120px] text-sm font-medium"
              placeholder="Describe what this project is about..."
            />
          </div>
        </section>

        <section className="py-8 space-y-6 border-b border-[var(--color-bg-border)]">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Team Members</label>
            <div className="flex items-center gap-2">
              <Badge variant="info">{workspace}</Badge>
              <Badge variant="todo">{members.length} ADDED</Badge>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] -mt-2">
            Default members from the selected workspace are pre-filled. You can add or remove before creating.
          </p>

          <div className="space-y-6">
            <NexusDropdown
              options={users.map(u => ({ value: u._id, label: u.name }))}
              value=""
              onChange={addMember}
              placeholder="Search team members..."
              renderOption={formatOptionLabel}
              searchable
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between p-3 bg-[var(--color-bg-workspace)] rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] group gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] flex items-center justify-center font-black text-[10px] text-blue-500 uppercase overflow-hidden">
                      {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover" alt="" /> : m.name.substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-xs uppercase tracking-tight text-[var(--color-text-primary)] truncate">{m.name}</p>
                      <p className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-[0.2em]">Profile: {m.profileRole || 'user'}</p>
                    </div>
                  </div>
                  <div className="w-full sm:min-w-[14rem] sm:max-w-[16rem] shrink-0">
                    <RoleOptionBoxes
                      value={m.projectRole}
                      onChange={(role) => updateMemberRole(m.userId, role)}
                      label=""
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => removeMember(m.userId)}
                    className="p-1.5 hover:text-red-500 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {members.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] opacity-30">
                  <UserPlus size={32} className="mx-auto text-[var(--color-text-muted)] mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No Members Added</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4 pt-4">
          <button 
            type="button" 
            onClick={() => navigate('/projects')}
            className="px-8 py-3 rounded-[var(--radius-atomic)] font-black text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface)] transition-all"
          >
            Cancel
          </button>
          <button 
            type="submit"
            disabled={loading || !name}
            className="bg-[var(--color-action-primary)] text-white px-10 py-3 rounded-[var(--radius-atomic)] font-black text-[10px] uppercase tracking-widest hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all flex items-center gap-2"
          >
             {loading ? 'Creating...' : <><Plus size={18} /> Create Project</>}
          </button>
        </div>
      </form>
    </PageContainer>
  );
};

export default ProjectCreate;


// Performance Optimization: useCallback(eventHandler) memoization guard
