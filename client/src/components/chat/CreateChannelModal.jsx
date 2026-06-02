import React, { useState, useMemo } from 'react';
import { NexusModal, Button, SearchInput } from '../ui';
import { useUserDirectory, useWorkspaces, useProjects } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeWorkspaceKey } from '../../utils/workspaceColors';
import ChannelProjectLinksPicker from './ChannelProjectLinksPicker';

const CreateChannelModal = ({ open, onClose, onCreate, loading }) => {
  const { user } = useAuth();
  const { data: users = [] } = useUserDirectory();
  const { data: workspaces = [] } = useWorkspaces();
  const { data: projects = [] } = useProjects();
  const [name, setName] = useState('');
  const [linkProjects, setLinkProjects] = useState(false);
  const [workspace, setWorkspace] = useState('');
  const [projectIds, setProjectIds] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const workspaceOptions = useMemo(() => {
    const fromWs = (workspaces || []).map((w) => normalizeWorkspaceKey(w.name));
    const fromProjects = projects.map((p) => normalizeWorkspaceKey(p.workspace || 'GENERAL'));
    return [...new Set([...fromWs, ...fromProjects])].filter(Boolean).sort();
  }, [workspaces, projects]);

  const filtered = users.filter((u) => {
    if (u._id === user?._id) return false;
    const q = search.toLowerCase();
    return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({
      name: trimmed,
      workspace: linkProjects && workspace ? workspace : 'GENERAL',
      projectIds: linkProjects ? projectIds : [],
      memberIds: selected,
    });
  };

  const resetOnClose = () => {
    setName('');
    setLinkProjects(false);
    setWorkspace('');
    setProjectIds([]);
    setSearch('');
    setSelected([]);
    onClose();
  };

  const canCreate = Boolean(name.trim()) && (!linkProjects || Boolean(workspace));

  return (
    <NexusModal isOpen={open} onClose={resetOnClose} title="New channel" size="md" showFooter={false}>
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Channel name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-sm"
            placeholder="e.g. Carousel"
            autoFocus
          />
        </div>

        <label className="flex items-center gap-2 text-[12px] cursor-pointer">
          <input
            type="checkbox"
            checked={linkProjects}
            onChange={(e) => {
              setLinkProjects(e.target.checked);
              if (!e.target.checked) {
                setWorkspace('');
                setProjectIds([]);
              }
            }}
            className="rounded"
          />
          <span>Link to projects (optional)</span>
        </label>

        {linkProjects && (
          <div className="space-y-2 pl-1 border-l-2 border-[var(--color-bg-border)] ml-1">
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                Workspace for project links
              </label>
              <select
                value={workspace}
                onChange={(e) => {
                  setWorkspace(e.target.value);
                  setProjectIds([]);
                }}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-sm"
              >
                <option value="">Select workspace</option>
                {workspaceOptions.map((ws) => (
                  <option key={ws} value={ws}>{ws}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Projects</label>
              <ChannelProjectLinksPicker
                workspace={workspace}
                selectedIds={projectIds}
                onChange={setProjectIds}
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Add members</label>
          <SearchInput value={search} onChange={setSearch} placeholder="Search team…" className="mt-1" />
          <div className="mt-2 max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
            {filtered.slice(0, 20).map((u) => (
              <button
                key={u._id}
                type="button"
                onClick={() => toggle(u._id)}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-[12px] flex items-center gap-2 ${
                  selected.includes(u._id)
                    ? 'bg-[var(--color-action-primary)]/15 border border-[var(--color-action-primary)]/40'
                    : 'hover:bg-[var(--color-bg-secondary)] border border-transparent'
                }`}
              >
                <span className="font-semibold truncate">{u.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={resetOnClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading || !canCreate}>
            Create channel
          </Button>
        </div>
      </div>
    </NexusModal>
  );
};

export default CreateChannelModal;
