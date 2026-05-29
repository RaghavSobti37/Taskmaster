import React, { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Briefcase, Search, Star, LayoutGrid, List, FolderPlus, Trash2
} from 'lucide-react';
import {
  Badge,
  ProgressBar,
  PageHeader,
  PageContainer,
  Card,
  Button,
  Input,
  PageSkeleton,
  NexusDropdown,
  NexusModal
} from '../../components/ui';
import { useProjects, useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';

const WORKSPACE_COLORS = [
  '#3498db', '#9b59b6', '#e74c3c', '#2ecc71', '#f97316',
  '#ec4899', '#06b6d4', '#eab308', '#64748b', '#8b5cf6',
];

const ProjectPreview = ({ project, accent, onNavigate, onToggleStar, isAdmin, onDragStart, onDragEnd }) => (
  <div
    draggable={isAdmin}
    onDragStart={(e) => {
      if (!isAdmin) return;
      e.dataTransfer.setData('application/project-id', project._id);
      e.dataTransfer.effectAllowed = 'move';
      onDragStart?.(project._id);
    }}
    onDragEnd={() => onDragEnd?.()}
    className={`p-2.5 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-secondary)]/40 transition-all cursor-pointer group/preview ${isAdmin ? 'cursor-grab active:cursor-grabbing' : ''}`}
    onClick={() => onNavigate(project._id)}
  >
    <div className="flex items-start justify-between gap-2 mb-2">
      <h4 className="text-[10px] font-black uppercase tracking-tight truncate group-hover/preview:text-[var(--color-action-primary)] transition-colors">
        {project.name?.toUpperCase()}
      </h4>
      <button
        onClick={(e) => onToggleStar(e, project)}
        className="p-0.5 rounded shrink-0 hover:bg-[var(--color-bg-border)] transition-all"
        title={project.starred ? 'Unstar' : 'Star project'}
      >
        <Star
          size={11}
          className={project.starred ? 'fill-amber-400 text-amber-400' : 'text-[var(--color-text-muted)] hover:text-amber-400'}
        />
      </button>
    </div>
    <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
      <span>{project.totalTasks || 0} tasks</span>
      <span style={{ color: accent }}>{project.progress || 0}%</span>
    </div>
    <ProgressBar progress={project.progress || 0} className="h-1" />
  </div>
);

const ProjectsView = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('workspace');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceColor, setNewWorkspaceColor] = useState(WORKSPACE_COLORS[0]);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [draggingProjectId, setDraggingProjectId] = useState(null);
  const [dragOverWorkspace, setDragOverWorkspace] = useState(null);
  const [draggingWorkspaceName, setDraggingWorkspaceName] = useState(null);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  const { data: workspaces = [], isLoading: loadingWorkspaces } = useWorkspaces();

  const loading = loadingProjects || loadingWorkspaces;

  const toggleStar = useCallback(async (e, project) => {
    e.stopPropagation();
    try {
      await axios.put(`/api/projects/${project._id}`, { starred: !project.starred });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  }, [queryClient]);

  const filteredProjects = useMemo(() => {
    let result = projects.filter(p => {
      const nameMatch = p.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const tagMatch = p.tags?.some(t => t?.toLowerCase().includes(searchTerm.toLowerCase()));
      const workspaceMatch = p.workspace?.toLowerCase().includes(searchTerm.toLowerCase());
      const statusMatch = filterStatus === 'all' || p.status === filterStatus;
      return (nameMatch || tagMatch || workspaceMatch) && statusMatch;
    });

    result.sort((a, b) => {
      if (b.starred !== a.starred) return (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'progress-high') return (b.progress || 0) - (a.progress || 0);
      if (sortBy === 'progress-low') return (a.progress || 0) - (b.progress || 0);
      if (sortBy === 'name') return a.name?.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [projects, searchTerm, filterStatus, sortBy]);

  const workspaceColorMap = useMemo(() => {
    const map = {};
    workspaces.forEach(w => {
      map[w.name.toUpperCase()] = w.color;
    });
    return map;
  }, [workspaces]);

  const getWorkspaceColor = useCallback((workspaceName) => {
    const key = (workspaceName || 'General').toUpperCase();
    return workspaceColorMap[key] || '#64748b';
  }, [workspaceColorMap]);

  const workspaceGroups = useMemo(() => {
    const groups = {};
    const knownNames = new Set(workspaces.map(w => w.name.toUpperCase()));

    workspaces.forEach(w => {
      groups[w.name.toUpperCase()] = [];
    });

    filteredProjects.forEach(project => {
      const key = (project.workspace || 'General').toUpperCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(project);
    });

    knownNames.forEach(name => {
      if (!groups[name]) groups[name] = [];
    });

    return Object.entries(groups)
      .map(([name, items]) => ({ name, color: getWorkspaceColor(name), projects: items }))
      .sort((a, b) => {
        if (a.name === 'GENERAL') return 1;
        if (b.name === 'GENERAL') return -1;
        return a.name.localeCompare(b.name);
      });
  }, [filteredProjects, workspaces, getWorkspaceColor]);

  const moveProjectToWorkspace = useCallback(async (projectId, workspaceName) => {
    if (!projectId || !workspaceName) return;
    try {
      await axios.put(`/api/projects/${projectId}`, { workspace: workspaceName });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err) {
      console.error('Failed to move project:', err);
    } finally {
      setDraggingProjectId(null);
      setDragOverWorkspace(null);
    }
  }, [queryClient]);

  const handleWorkspaceDrop = useCallback((e, workspaceName) => {
    e.preventDefault();
    if (!isAdmin) return;
    const projectId = e.dataTransfer.getData('application/project-id');
    if (projectId) moveProjectToWorkspace(projectId, workspaceName);
  }, [isAdmin, moveProjectToWorkspace]);

  const handleWorkspaceReorder = useCallback(async (sourceIndex, destIndex) => {
    if (!isAdmin || sourceIndex === destIndex) return;
    try {
      const reordered = [...workspaceGroups];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(destIndex, 0, moved);
      const order = reordered.map(w => w.name);
      await axios.put('/api/projects/workspaces', { order });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    } catch (err) {
      console.error('Failed to reorder workspaces:', err);
    } finally {
      setDraggingWorkspaceName(null);
    }
  }, [isAdmin, workspaceGroups, queryClient]);

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setCreatingWorkspace(true);
    try {
      await axios.post('/api/projects/workspaces', {
        name: newWorkspaceName.trim(),
        color: newWorkspaceColor,
      });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setCreateModalOpen(false);
      setNewWorkspaceName('');
      setNewWorkspaceColor(WORKSPACE_COLORS[0]);
    } catch (err) {
      console.error('Failed to create workspace:', err);
    } finally {
      setCreatingWorkspace(false);
    }
  };

  if (loading && projects.length === 0) return <PageSkeleton />;

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Project Portfolio"
        subtitle="Manage and track your active projects and their progress."
        icon={Briefcase}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setCreateModalOpen(true)}>
              <FolderPlus size={16} /> New Workspace
            </Button>
            <Button onClick={() => navigate('/projects/new')}>
              <Plus size={16} /> New Project
            </Button>
          </div>
        }
      />

      <Card className="flex flex-col border-none shadow-none bg-transparent">
        <div className="mb-4 flex flex-nowrap items-center gap-2 w-full min-w-0 overflow-x-auto">
          <Input
            icon={Search}
            placeholder="Search by name, tags, or workspace..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[12rem] min-w-0"
          />
            <div className="inline-flex shrink-0 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setViewMode('workspace')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg tm-section-label whitespace-nowrap transition-colors ${
                  viewMode === 'workspace'
                    ? 'bg-[var(--color-action-primary)] text-white shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                <LayoutGrid size={12} className="shrink-0" /> Workspaces
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg tm-section-label whitespace-nowrap transition-colors ${
                  viewMode === 'all'
                    ? 'bg-[var(--color-action-primary)] text-white shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                <List size={12} className="shrink-0" /> All Projects
              </button>
            </div>
            <NexusDropdown
              options={[
                { value: 'all', label: 'All Projects' },
                { value: 'active', label: 'Active Only' },
                { value: 'completed', label: 'Completed' },
                { value: 'archived', label: 'Archived' },
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="Filter status"
              className="w-[10.5rem] shrink-0"
            />
            <NexusDropdown
              options={[
                { value: 'newest', label: 'Newest First' },
                { value: 'oldest', label: 'Oldest First' },
                { value: 'progress-high', label: 'Highest Progress' },
                { value: 'progress-low', label: 'Lowest Progress' },
                { value: 'name', label: 'Alphabetical' },
              ]}
              value={sortBy}
              onChange={setSortBy}
              placeholder="Sort by"
              className="w-[11rem] shrink-0"
            />
        </div>

        {isAdmin && draggingProjectId && (
          <div className="mb-4 p-3 rounded-xl border-2 border-dashed border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-action-primary)] mb-2">
              Drop project into workspace
            </p>
            <div className="flex flex-wrap gap-2">
              {workspaceGroups.map((group) => (
                <button
                  key={group.name}
                  type="button"
                  onDragOver={(e) => { e.preventDefault(); setDragOverWorkspace(group.name); }}
                  onDragLeave={() => setDragOverWorkspace(null)}
                  onDrop={(e) => handleWorkspaceDrop(e, group.name)}
                  className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                    dragOverWorkspace === group.name
                      ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/15 scale-105'
                      : 'border-[var(--color-bg-border)] bg-[var(--color-bg-surface)]'
                  }`}
                  style={{ borderLeftColor: group.color, borderLeftWidth: 4 }}
                >
                  {group.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {isAdmin && viewMode === 'workspace' && (
          <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
            Admin: drag project cards between workspaces • drag workspace headers to reorder
          </p>
        )}

        {viewMode === 'workspace' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {workspaceGroups.map((group, index) => (
                <motion.div
                  key={group.name}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2, delay: index * 0.04 }}
                >
                  <Card
                    className={`p-0 flex flex-col h-full overflow-hidden transition-all ${
                      dragOverWorkspace === group.name ? 'ring-2 ring-[var(--color-action-primary)] scale-[1.01]' : ''
                    }`}
                    onDragOver={(e) => {
                      if (!isAdmin) return;
                      e.preventDefault();
                      setDragOverWorkspace(group.name);
                    }}
                    onDragLeave={() => setDragOverWorkspace(null)}
                    onDrop={(e) => handleWorkspaceDrop(e, group.name)}
                  >
                    <div className="h-1.5 w-full" style={{ backgroundColor: group.color }} />
                    <div 
                      className={`p-4 space-y-3 ${isAdmin ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      draggable={isAdmin}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/workspace-index', workspaceGroups.findIndex(w => w.name === group.name));
                        setDraggingWorkspaceName(group.name);
                      }}
                      onDragEnd={() => setDraggingWorkspaceName(null)}
                      onDragOver={(e) => {
                        if (!isAdmin) return;
                        e.preventDefault();
                        if (e.dataTransfer.types.includes('application/project-id')) {
                          setDragOverWorkspace(group.name);
                        }
                      }}
                      onDragLeave={() => {
                        if (draggingProjectId) setDragOverWorkspace(null);
                      }}
                      onDrop={(e) => {
                        const projectId = e.dataTransfer.getData('application/project-id');
                        const workspaceIndex = e.dataTransfer.getData('application/workspace-index');
                        if (projectId) {
                          handleWorkspaceDrop(e, group.name);
                        } else if (workspaceIndex !== '') {
                          const destIndex = workspaceGroups.findIndex(w => w.name === group.name);
                          handleWorkspaceReorder(Number(workspaceIndex), destIndex);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                          <h3 className="text-sm font-black uppercase tracking-tight truncate">{group.name}</h3>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="info" className="!py-0 !px-2 !text-[8px]">
                            {group.projects.length} {group.projects.length === 1 ? 'project' : 'projects'}
                          </Badge>
                          {isAdmin && group.projects.length === 0 && !['TSC ACADEMY', 'TSC ARTISTS', 'TSC FILMS', 'TSC TECH', 'GENERAL'].includes(group.name) && (
                            <Button 
                              variant="ghost" 
                              size="xs" 
                              className="!text-red-400 hover:bg-red-500/10 !p-1"
                              onClick={() => {
                                if (window.confirm(`Delete workspace "${group.name}"? This action cannot be undone.`)) {
                                  axios.delete(`/api/projects/workspaces/${group.name}`)
                                    .then(() => queryClient.invalidateQueries({ queryKey: ['workspaces'] }))
                                    .catch(err => alert(err.response?.data?.error || 'Failed to delete workspace'));
                                }
                              }}
                              title="Delete workspace"
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </div>

                      {group.projects.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {group.projects.slice(0, 6).map(project => (
                            <ProjectPreview
                              key={project._id}
                              project={project}
                              accent={group.color}
                              onNavigate={(id) => navigate(`/projects/${id}`)}
                              onToggleStar={toggleStar}
                              isAdmin={isAdmin}
                              onDragStart={setDraggingProjectId}
                              onDragEnd={() => setDraggingProjectId(null)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center border border-dashed border-[var(--color-bg-border)] rounded-xl">
                          <p className="text-[9px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">No projects yet</p>
                        </div>
                      )}

                      {group.projects.length > 6 && (
                        <p className="text-[9px] font-black uppercase text-[var(--color-text-muted)] tracking-widest text-center">
                          +{group.projects.length - 6} more
                        </p>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>

            {workspaceGroups.length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
                <Briefcase size={32} className="mx-auto text-[var(--color-text-muted)] mb-3 opacity-20" />
                <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">No workspaces found</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {filteredProjects.map((project, index) => {
                const accent = getWorkspaceColor(project.workspace);
                return (
                  <motion.div
                    key={project._id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: index * 0.04 }}
                  >
                    <Card
                      className={`p-0 flex flex-col h-full group relative overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer ${
                        draggingProjectId === project._id ? 'opacity-50 scale-95' : ''
                      } ${isAdmin ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      style={{ borderColor: project.starred ? accent : undefined }}
                      draggable={isAdmin}
                      onDragStart={(e) => {
                        if (!isAdmin) return;
                        e.dataTransfer.setData('application/project-id', project._id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggingProjectId(project._id);
                      }}
                      onDragEnd={() => setDraggingProjectId(null)}
                      onClick={() => navigate(`/projects/${project._id}`)}
                    >
                      <div className="h-1 w-full" style={{ backgroundColor: accent }} />

                      <div className="p-3 space-y-3 flex flex-col flex-1 group-hover:bg-[var(--color-bg-secondary)]/30 transition-colors duration-200">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                              <h3 className="text-xs font-black uppercase tracking-tight truncate group-hover:text-[var(--color-action-primary)] transition-colors">
                                {project.name?.toUpperCase()}
                              </h3>
                            </div>
                            <p className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-widest mt-1 pl-3.5">
                              {(project.workspace || 'General').toUpperCase()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            <Badge variant={project.status === 'completed' ? 'success' : 'info'} className="!py-0 !px-1.5 !text-[8px]">
                              {project.status || 'Active'}
                            </Badge>
                            <button
                              onClick={e => toggleStar(e, project)}
                              className="p-1 rounded-lg transition-all hover:scale-110 hover:bg-[var(--color-bg-border)]"
                              title={project.starred ? 'Unstar' : 'Star project'}
                            >
                              <Star
                                size={13}
                                className={project.starred ? 'fill-amber-400 text-amber-400' : 'text-[var(--color-text-muted)] hover:text-amber-400'}
                              />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1 mt-auto">
                          <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                            <span>Progress · <span className="normal-case">{project.totalTasks || 0} tasks</span></span>
                            <span style={{ color: accent }}>{project.progress || 0}%</span>
                          </div>
                          <ProgressBar progress={project.progress || 0} className="h-1" />
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredProjects.length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
                <Briefcase size={32} className="mx-auto text-[var(--color-text-muted)] mb-3 opacity-20" />
                <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">No projects found</p>
              </div>
            )}
          </div>
        )}
      </Card>

      <NexusModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Workspace"
        size="md"
        showFooter={false}
      >
        <form onSubmit={handleCreateWorkspace} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">
              Workspace Name
            </label>
            <Input
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="e.g. TSC ACADEMY"
              className="!py-2.5 !text-xs font-bold uppercase"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">
              Workspace Color
            </label>
            <div className="flex items-center gap-2 flex-wrap p-3 bg-[var(--color-bg-workspace)] rounded-xl border border-[var(--color-bg-border)]">
              {WORKSPACE_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewWorkspaceColor(c)}
                  className={`w-7 h-7 rounded-full transition-all duration-200 ${
                    newWorkspaceColor === c
                      ? 'ring-2 ring-offset-2 ring-offset-[var(--color-bg-workspace)] scale-110 ring-[var(--color-text-primary)]'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creatingWorkspace || !newWorkspaceName.trim()}>
              {creatingWorkspace ? 'Creating...' : 'Create Workspace'}
            </Button>
          </div>
        </form>
      </NexusModal>
    </PageContainer>
  );
};

export default ProjectsView;
