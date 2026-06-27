import React, { useState, useMemo, useCallback, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Briefcase, Star, LayoutGrid, List, FolderPlus, Trash2, Settings, GripVertical, ClipboardCheck, Layers,
} from 'lucide-react';
import { Badge, ProgressBar, Button, Input, PageSkeleton, NexusDropdown, ListPageLayout, SearchInput, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import { NexusModal } from '../../components/ui/modals';;
import { useProjects, useWorkspaces, useReviewTasks, useDashboardTasks } from '../../hooks/useTaskmasterQueries';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { useConfirm } from '../../contexts/confirmContext';
import { getWorkspaceColor as resolveWorkspaceColor, PRESET_WORKSPACE_COLORS, normalizeWorkspaceKey } from '../../utils/workspaceColors';
import WorkspaceColorPicker from '../../components/ui/WorkspaceColorPicker';
import { countReviewTasksByProject, countTasksByProject } from '../../utils/taskReview';
import { filterOverdueTasks } from '../../utils/dashboardTasks';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';
import { projectCardAccentClass, ProjectCardStatusOverlay } from '../../components/project/ProjectStatusPing';

const ProjectPreview = ({
  project, accent, onNavigate, onToggleStar, canMove, onDragStart, onDragEnd, reviewCount = 0, overdueCount = 0,
}) => (
  <div
    className={`relative p-2.5 bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-secondary)]/40 transition-colors cursor-pointer group/preview min-w-0 ${projectCardAccentClass({ reviewCount, overdueCount })}`}
    onClick={() => onNavigate(project._id)}
  >
    <div className="flex items-start justify-between gap-2 mb-2">
      <h4 className="text-[10px] font-black uppercase tracking-tight truncate group-hover/preview:text-[var(--color-action-primary)] transition-colors min-w-0 flex-1">
        {project.name?.toUpperCase()}
      </h4>
      <div className="flex items-center gap-1 shrink-0">
        <ProjectCardStatusOverlay reviewCount={reviewCount} overdueCount={overdueCount} />
        {canMove && (
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData('application/project-id', project._id);
              e.dataTransfer.effectAllowed = 'move';
              onDragStart?.(project._id);
            }}
            onDragEnd={(e) => {
              e.stopPropagation();
              onDragEnd?.();
            }}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] opacity-60 group-hover/preview:opacity-100 transition-all"
            title="Drag to move workspace"
          >
            <GripVertical size={14} />
          </div>
        )}
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
    </div>
    <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
      <span>{project.totalTasks || 0} tasks</span>
      <span className="tabular-nums" title={`Task completion: ${project.completedTasks ?? 0} of ${project.totalTasks || 0} tasks done`}>{project.progress || 0}%</span>
    </div>
    <ProgressBar progress={project.progress || 0} className="h-1" />
    <div className="flex justify-end mt-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(project._id, 'analytics');
        }}
        className="text-blue-500 hover:underline font-bold text-[9px]"
      >
        Analytics
      </button>
    </div>
  </div>
);

const ProjectsView = () => {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('workspace');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceColor, setNewWorkspaceColor] = useState(PRESET_WORKSPACE_COLORS[0]);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [draggingProjectId, setDraggingProjectId] = useState(null);
  const [dragOverWorkspace, setDragOverWorkspace] = useState(null);
  const [draggingWorkspaceName, setDraggingWorkspaceName] = useState(null);
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading: loadingProjects, isError: projectsError, error: projectsErr, refetch: refetchProjects } = useProjects();
  const deferProjectsSecondary = useDeferredQueryEnabled(!loadingProjects);
  const { data: workspaces = [], isLoading: loadingWorkspaces, isError: workspacesError, error: workspacesErr, refetch: refetchWorkspaces } = useWorkspaces(deferProjectsSecondary);
  const { data: reviewTasks = [] } = useReviewTasks(!!user?._id && deferProjectsSecondary);
  const { data: dashboardTasks = [] } = useDashboardTasks(user?._id, !!user?._id && deferProjectsSecondary);

  const navigateToProject = useCallback((projectId, tab) => {
    if (tab === 'analytics') {
      navigate(`/projects/${projectId}/analytics`);
      return;
    }
    navigate(`/projects/${projectId}`, tab ? { state: { tab } } : undefined);
  }, [navigate]);

  const reviewCountByProject = useMemo(() => countReviewTasksByProject(reviewTasks), [reviewTasks]);
  const overdueCountByProject = useMemo(
    () => countTasksByProject(filterOverdueTasks(dashboardTasks)),
    [dashboardTasks]
  );
  const totalReviewCount = reviewTasks.length;

  useEffect(() => {
    if (!user?._id) return;
    refetchProjects();
    refetchWorkspaces();
  }, [user?._id, refetchProjects, refetchWorkspaces]);

  useEffect(() => {
    if (location.state?.openCreateWorkspace) {
      setCreateModalOpen(true);
      navigate('/projects', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const loading = loadingProjects || loadingWorkspaces;
  const listQueryError = projectsError ? projectsErr : workspacesError ? workspacesErr : null;
  const handleListRetry = () => {
    if (projectsError) refetchProjects();
    if (workspacesError) refetchWorkspaces();
  };

  const toggleStar = useCallback(async (e, project) => {
    e.stopPropagation();
    try {
      await axios.put(`/api/projects/${project._id}`, { starred: !project.starred });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  }, [queryClient]);

  const canMoveProject = useCallback((project) => {
    if (isAdmin) return true;
    const uid = user?._id?.toString();
    if (!uid) return false;
    const ownerId = (project.owner?._id || project.owner)?.toString?.();
    if (ownerId === uid) return true;
    return (project.members || []).some((m) => (m?._id || m)?.toString?.() === uid);
  }, [isAdmin, user]);

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

  const getWorkspaceColor = useCallback(
    (workspaceName) => resolveWorkspaceColor(workspaceName, workspaces),
    [workspaces]
  );

  const workspaceGroups = useMemo(() => {
    const groups = {};

    workspaces.forEach((w) => {
      groups[normalizeWorkspaceKey(w.name)] = [];
    });

    filteredProjects.forEach((project) => {
      const key = normalizeWorkspaceKey(project.workspace || 'General');
      if (!groups[key]) groups[key] = [];
      groups[key].push(project);
    });

    const seen = new Set();
    const orderedNames = [];
    workspaces.forEach((w) => {
      const name = normalizeWorkspaceKey(w.name);
      if (!seen.has(name)) {
        seen.add(name);
        orderedNames.push(name);
      }
    });
    Object.keys(groups).forEach((name) => {
      if (!seen.has(name)) {
        seen.add(name);
        orderedNames.push(name);
      }
    });

    return orderedNames
      .map((name) => {
        const ws = workspaces.find((w) => normalizeWorkspaceKey(w.name) === name);
        return {
          name: ws?.name || name,
          color: getWorkspaceColor(name),
          projects: groups[name] || [],
          defaultMemberCount: ws?.defaultMembers?.length || 0,
          order: ws?.order ?? 999,
        };
      })
      .filter((group) => {
        if (isAdmin) return true;
        if (group.projects.length > 0) return true;
        return workspaces.some((w) => normalizeWorkspaceKey(w.name) === normalizeWorkspaceKey(group.name));
      });
  }, [filteredProjects, workspaces, getWorkspaceColor, isAdmin]);

  const moveProjectToWorkspace = useCallback(async (projectId, workspaceName) => {
    if (!projectId || !workspaceName) return;
    const project = projects.find((p) => p._id === projectId);
    if (project && !canMoveProject(project)) return;
    try {
      await axios.put(`/api/projects/${projectId}`, { workspace: workspaceName });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err) {
      console.error('Failed to move project:', err);
      alert(err.response?.data?.error || 'Failed to move project');
    } finally {
      setDraggingProjectId(null);
      setDragOverWorkspace(null);
    }
  }, [queryClient, projects, canMoveProject]);

  const handleWorkspaceDrop = useCallback((e, workspaceName) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('application/project-id');
    if (projectId) moveProjectToWorkspace(projectId, workspaceName);
  }, [moveProjectToWorkspace]);

  const handleWorkspaceReorder = useCallback(async (sourceIndex, destIndex) => {
    if (sourceIndex === destIndex || sourceIndex < 0 || destIndex < 0) return;
    const reordered = [...workspaceGroups];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(destIndex, 0, moved);
    const order = reordered.map((w) => w.name);
    const previousWorkspaces = queryClient.getQueryData(['workspaces']);

    queryClient.setQueryData(['workspaces'], (old = []) => {
      const byName = new Map(old.map((w) => [w.name.toUpperCase(), w]));
      return order
        .map((name, idx) => {
          const ws = byName.get(name.toUpperCase());
          return ws ? { ...ws, order: idx } : null;
        })
        .filter(Boolean);
    });

    try {
      const { data } = await axios.put('/api/projects/workspaces', { order });
      queryClient.setQueryData(['workspaces'], data);
    } catch (err) {
      console.error('Failed to reorder workspaces:', err);
      if (previousWorkspaces) queryClient.setQueryData(['workspaces'], previousWorkspaces);
    } finally {
      setDraggingWorkspaceName(null);
    }
  }, [workspaceGroups, queryClient]);

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
      setNewWorkspaceColor(PRESET_WORKSPACE_COLORS[0]);
    } catch (err) {
      console.error('Failed to create workspace:', err);
    } finally {
      setCreatingWorkspace(false);
    }
  };

  if (loading && projects.length === 0) return <PageSkeleton />;

  const activeProjectCount = filteredProjects.filter((p) => p.status === 'active').length;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      overview={{
        stats: [
          {
            id: 'total',
            label: 'Projects',
            value: filteredProjects.length,
            icon: Briefcase,
            variant: 'info',
            info: 'Projects matching your search and status filters.',
          },
          {
            id: 'active',
            label: 'Active',
            value: activeProjectCount,
            icon: Layers,
            variant: 'mint',
            info: 'Projects currently marked active.',
          },
          {
            id: 'review',
            label: 'Awaiting Review',
            value: totalReviewCount,
            icon: ClipboardCheck,
            variant: 'apricot',
            info: 'Tasks you must approve across all projects.',
          },
          {
            id: 'workspaces',
            label: 'Workspaces',
            value: workspaceGroups.length,
            icon: LayoutGrid,
            variant: 'slate',
            info: 'Workspace groups in grid view.',
          },
        ],
      }}
      toolbar={
        <>
          <SearchInput
            placeholder="Search name, tags, workspace…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div
            data-mobile-inline
            data-filter-label="View"
            className="tm-toolbar-control inline-flex shrink-0 items-center rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] px-1 gap-0.5"
          >
            <button
              type="button"
              onClick={() => setViewMode('workspace')}
              title="Workspaces"
              className={`inline-flex flex-row items-center justify-center gap-1 px-2.5 h-7 rounded-[var(--radius-atomic)] text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${viewMode === 'workspace'
                ? 'bg-[var(--color-bg-primary)] text-[var(--color-action-primary)] border border-[var(--color-bg-border)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
            >
              <LayoutGrid size={12} className="shrink-0" />
              <span className="whitespace-nowrap lg:hidden">Grid</span>
              <span className="whitespace-nowrap hidden lg:inline">Workspaces</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              title="All projects"
              className={`inline-flex flex-row items-center justify-center gap-1 px-2.5 h-7 rounded-[var(--radius-atomic)] text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${viewMode === 'all'
                ? 'bg-[var(--color-bg-primary)] text-[var(--color-action-primary)] border border-[var(--color-bg-border)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
            >
              <List size={12} className="shrink-0" />
              <span className="whitespace-nowrap">All</span>
            </button>
          </div>
          <NexusDropdown
            variant="compact"
            data-filter-label="Status"
            options={[
              { value: 'all', label: 'All Projects' },
              { value: 'active', label: 'Active Only' },
              { value: 'completed', label: 'Completed' },
              { value: 'archived', label: 'Archived' },
            ]}
            value={filterStatus}
            onChange={setFilterStatus}
            placeholder="All projects"
          />
          <NexusDropdown
            variant="compact"
            data-filter-label="Sort by"
            options={[
              { value: 'newest', label: 'Newest First' },
              { value: 'oldest', label: 'Oldest First' },
              { value: 'progress-high', label: 'Highest Progress' },
              { value: 'progress-low', label: 'Lowest Progress' },
              { value: 'name', label: 'Alphabetical' },
            ]}
            value={sortBy}
            onChange={setSortBy}
            placeholder="Newest first"
          />
        </>
      }
      toolbarActions={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 shrink-0"
          >
            <FolderPlus size={14} />
            Add Workspace
          </Button>
          <Button
            size="sm"
            data-mobile-primary
            onClick={() => navigate('/projects/new')}
            className="flex items-center gap-1.5 shrink-0"
          >
            <Plus size={14} />
            New Project
          </Button>
        </>
      }
    >
      {listQueryError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(listQueryError, 'Failed to load projects')}
          onRetry={handleListRetry}
        />
      )}
      <div className="flex flex-col">
        {draggingProjectId && (
          <div className="mb-4 p-3 rounded-xl border-2 border-dashed border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-action-primary)] mb-2">
              Drop project into a workspace
            </p>
            <div className="flex flex-wrap gap-2">
              {workspaceGroups.map((group) => (
                <button
                  key={group.name}
                  type="button"
                  onDragOver={(e) => { e.preventDefault(); setDragOverWorkspace(group.name); }}
                  onDragLeave={() => setDragOverWorkspace(null)}
                  onDrop={(e) => handleWorkspaceDrop(e, group.name)}
                  className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${dragOverWorkspace === group.name
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
                  <div
                    className={`flex flex-col h-full overflow-hidden border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] transition-colors ${dragOverWorkspace === group.name
                      ? `ring-1 ${draggingWorkspaceName ? 'ring-amber-500/60' : 'ring-[var(--color-action-primary)]'}`
                      : ''
                      } ${draggingWorkspaceName === group.name ? 'opacity-70' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverWorkspace(group.name);
                    }}
                    onDragLeave={() => setDragOverWorkspace(null)}
                    onDrop={(e) => handleWorkspaceDrop(e, group.name)}
                  >
                    <div className="h-1 w-full shrink-0" style={{ backgroundColor: group.color }} />
                    <div
                      className="p-3 space-y-3"
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.types.includes('application/project-id')) {
                          setDragOverWorkspace(group.name);
                        } else if (e.dataTransfer.types.includes('application/workspace-index')) {
                          setDragOverWorkspace(group.name);
                        }
                      }}
                      onDragLeave={() => {
                        if (draggingProjectId || draggingWorkspaceName) setDragOverWorkspace(null);
                      }}
                      onDrop={(e) => {
                        const projectId = e.dataTransfer.getData('application/project-id');
                        const workspaceIndex = e.dataTransfer.getData('application/workspace-index');
                        if (projectId) {
                          handleWorkspaceDrop(e, group.name);
                        } else if (workspaceIndex !== '') {
                          const destIndex = workspaceGroups.findIndex((w) => w.name === group.name);
                          handleWorkspaceReorder(Number(workspaceIndex), destIndex);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData(
                              'application/workspace-index',
                              String(workspaceGroups.findIndex((w) => w.name === group.name))
                            );
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggingWorkspaceName(group.name);
                          }}
                          onDragEnd={() => setDraggingWorkspaceName(null)}
                          className={`cursor-grab active:cursor-grabbing p-1 rounded-lg shrink-0 transition-colors ${draggingWorkspaceName === group.name
                            ? 'text-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-border)]'
                            }`}
                          title="Drag to reorder workspace"
                        >
                          <GripVertical size={16} />
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/workspaces/${encodeURIComponent(group.name)}`)}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                        >
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                          <h3 className="text-sm font-black uppercase tracking-tight truncate">{group.name}</h3>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="info" className="!py-0 !px-2 !text-[8px]">
                            {group.projects.length} {group.projects.length === 1 ? 'project' : 'projects'}
                          </Badge>
                          {group.defaultMemberCount > 0 && (
                            <Badge variant="todo" className="!py-0 !px-2 !text-[8px]" title="Default members auto-added to new projects in this workspace">
                              {group.defaultMemberCount} default{group.defaultMemberCount === 1 ? '' : 's'}
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="xs"
                            className="!p-1"
                            onClick={() => navigate(`/workspaces/${encodeURIComponent(group.name)}`)}
                            title="Workspace settings"
                          >
                            <Settings size={14} />
                          </Button>
                          {isAdmin && group.projects.length === 0 && !['TSC ACADEMY', 'TSC ARTISTS', 'TSC FILMS', 'TSC TECH', 'GENERAL'].includes(group.name) && (
                            <Button
                              variant="ghost"
                              size="xs"
                              className="!text-red-400 hover:bg-red-500/10 !p-1"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Delete workspace?',
                                  message: `Delete workspace "${group.name}"? This action cannot be undone.`,
                                  confirmLabel: 'Delete',
                                  type: 'danger',
                                });
                                if (!ok) return;
                                axios.delete(`/api/projects/workspaces/${group.name}`)
                                  .then(() => queryClient.invalidateQueries({ queryKey: ['workspaces'] }))
                                  .catch(err => alert(err.response?.data?.error || 'Failed to delete workspace'));
                              }}
                              title="Delete workspace"
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </div>

                      {group.projects.length > 0 ? (
                        <div className="grid grid-cols-2 gap-px bg-[var(--color-bg-border)] border-t border-[var(--color-bg-border)]">
                          {group.projects.map(project => (
                            <ProjectPreview
                              key={project._id}
                              project={project}
                              accent={group.color}
                              reviewCount={reviewCountByProject[String(project._id)] || 0}
                              overdueCount={overdueCountByProject[String(project._id)] || 0}
                              canMove={canMoveProject(project)}
                              onNavigate={navigateToProject}
                              onToggleStar={toggleStar}
                              onDragStart={setDraggingProjectId}
                              onDragEnd={() => setDraggingProjectId(null)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center border-t border-dashed border-[var(--color-bg-border)]">
                          <p className="text-[9px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">No projects yet</p>
                        </div>
                      )}
                    </div>
                  </div>
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
                const reviewCount = reviewCountByProject[String(project._id)] || 0;
                const overdueCount = overdueCountByProject[String(project._id)] || 0;
                const canMove = canMoveProject(project);
                return (
                  <motion.div
                    key={project._id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: index * 0.04 }}
                  >
                    <div
                      className={`flex flex-col h-full group relative overflow-hidden border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] cursor-pointer transition-colors hover:bg-[var(--color-bg-secondary)]/30 ${draggingProjectId === project._id ? 'opacity-50' : ''
                        } ${projectCardAccentClass({ reviewCount, overdueCount })}`}
                      style={project.starred ? { borderTopColor: accent, borderTopWidth: 2 } : undefined}
                      onClick={() => navigateToProject(project._id)}
                    >
                      <div className="h-0.5 w-full shrink-0" style={{ backgroundColor: accent }} />

                      <div className="p-3 space-y-3 flex flex-col flex-1">
                        <div className="flex justify-between items-start gap-2">
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
                          <div className="flex items-center gap-1 shrink-0">
                            <ProjectCardStatusOverlay reviewCount={reviewCount} overdueCount={overdueCount} />
                            {canMove && (
                              <div
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  e.dataTransfer.setData('application/project-id', project._id);
                                  e.dataTransfer.effectAllowed = 'move';
                                  setDraggingProjectId(project._id);
                                }}
                                onDragEnd={(e) => {
                                  e.stopPropagation();
                                  setDraggingProjectId(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="cursor-grab active:cursor-grabbing p-1 rounded-lg hover:bg-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] opacity-60 group-hover:opacity-100 transition-all"
                                title="Drag to move workspace"
                              >
                                <GripVertical size={14} />
                              </div>
                            )}
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
                            <span className="tabular-nums" title={`Task completion: ${project.completedTasks ?? 0} of ${project.totalTasks || 0} tasks done`}>{project.progress || 0}%</span>
                          </div>
                          <ProgressBar progress={project.progress || 0} className="h-1" />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateToProject(project._id, 'analytics');
                              }}
                              className="text-blue-500 hover:underline font-bold text-[9px]"
                            >
                              Analytics
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
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
      </div>

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
            <WorkspaceColorPicker
              value={newWorkspaceColor}
              onChange={setNewWorkspaceColor}
            />
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
    </ListPageLayout>
  );
};

export default ProjectsView;
