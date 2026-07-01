import React, { useState, useMemo, useCallback, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Briefcase, Star, LayoutGrid, List, FolderPlus, Trash2, Settings,
  GripVertical, ClipboardCheck, Layers, Move, Copy, Table2, CheckSquare, Square,
  Users,
} from 'lucide-react';
import {
  Badge, ProgressBar, Button, Input, PageSkeleton,
  ListPageLayout, SearchInput, QueryErrorBanner, getQueryErrorMessage, EmptyState,
} from '../../components/ui';
import { countActiveFilters } from '../../components/ui/selectionFilterUtils';
import { NexusModal } from '../../components/ui/modals';
import {
  useProjects, useWorkspaces, useReviewTasks, useDashboardTasks, useUpdateProject,
} from '../../hooks/useTaskmasterQueries';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { useConfirm } from '../../contexts/confirmContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getWorkspaceColor as resolveWorkspaceColor, PRESET_WORKSPACE_COLORS, normalizeWorkspaceKey,
} from '../../utils/workspaceColors';
import WorkspaceColorPicker from '../../components/ui/WorkspaceColorPicker';
import WorkspaceSelect from '../../components/forms/WorkspaceSelect';
import { countReviewTasksByProject, countTasksByProject } from '../../utils/taskReview';
import { filterOverdueTasks } from '../../utils/dashboardTasks';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';
import { projectCardAccentClass, ProjectCardStatusOverlay } from '../../components/project/ProjectStatusPing';
import { loadPageFilters, savePageFilters } from '../../utils/pageFilterStorage';
import { buildProjectsActiveFilterChips } from '../../utils/activeFilterChips';

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_VARIANT = { active: 'mint', completed: 'success', archived: 'slate', planning: 'info' };

function relativeDate(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function MemberAvatars({ members = [], max = 3 }) {
  if (!members.length) return null;
  const visible = members.slice(0, max);
  const extra = members.length - max;
  return (
    <div className="flex -space-x-1.5 items-center">
      {visible.map((m, i) => {
        const id = m?._id || m;
        const name = m?.name || '?';
        const avatar = m?.avatar;
        return (
          <div
            key={id || i}
            className="w-4 h-4 rounded-full border border-[var(--color-bg-surface)] bg-[var(--color-bg-border)] flex items-center justify-center text-[6px] font-black uppercase overflow-hidden shrink-0"
            title={name}
          >
            {avatar
              ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
              : name.slice(0, 2)}
          </div>
        );
      })}
      {extra > 0 && (
        <div className="w-4 h-4 rounded-full border border-[var(--color-bg-surface)] bg-[var(--color-bg-border)] flex items-center justify-center text-[6px] font-black text-[var(--color-text-muted)] shrink-0">
          +{extra}
        </div>
      )}
    </div>
  );
}

// ─── ProjectPreview (workspace grid card) ───────────────────────────────────

const ProjectPreview = ({
  project, accent, onNavigate, onToggleStar, canMove, onDragStart, onDragEnd,
  reviewCount = 0, overdueCount = 0, onMoveClick, isSelected = false, onSelect, showSelect = false,
}) => {
  const statusVariant = STATUS_VARIANT[project.status] || 'info';
  return (
    <div
      className={`relative p-2.5 bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-secondary)]/40 transition-colors cursor-pointer group/preview min-w-0 ${projectCardAccentClass({ reviewCount, overdueCount })} ${isSelected ? 'ring-1 ring-[var(--color-action-primary)] bg-[var(--color-action-primary)]/5' : ''}`}
      onClick={() => onNavigate(project._id)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {showSelect && (
            <button
              onClick={(e) => { e.stopPropagation(); onSelect?.(project._id); }}
              className="p-0.5 shrink-0"
              title={isSelected ? 'Deselect' : 'Select'}
            >
              {isSelected
                ? <CheckSquare size={11} className="text-[var(--color-action-primary)]" />
                : <Square size={11} className="text-[var(--color-text-muted)]" />}
            </button>
          )}
          <h4 className="text-[10px] font-black uppercase tracking-tight truncate group-hover/preview:text-[var(--color-action-primary)] transition-colors min-w-0 flex-1">
            {project.name?.toUpperCase()}
          </h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant={statusVariant} className="!py-0 !px-1 !text-[7px] shrink-0 hidden sm:inline-flex">
            {project.status || 'active'}
          </Badge>
          <ProjectCardStatusOverlay reviewCount={reviewCount} overdueCount={overdueCount} />
          {canMove && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onMoveClick?.(project); }}
                className="p-0.5 rounded shrink-0 hover:bg-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)] opacity-0 group-hover/preview:opacity-100 transition-all"
                title="Move to workspace"
              >
                <Move size={11} />
              </button>
              <div
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData('application/project-id', project._id);
                  e.dataTransfer.effectAllowed = 'move';
                  onDragStart?.(project._id);
                }}
                onDragEnd={(e) => { e.stopPropagation(); onDragEnd?.(); }}
                onClick={(e) => e.stopPropagation()}
                className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] opacity-60 group-hover/preview:opacity-100 transition-all"
                title="Drag to move workspace"
              >
                <GripVertical size={14} />
              </div>
            </>
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
        <span className="tabular-nums">{project.progress || 0}%</span>
      </div>
      <ProgressBar progress={project.progress || 0} className="h-1" />
      <div className="flex items-center justify-between mt-1.5 gap-1">
        <MemberAvatars members={project.members} max={3} />
        <div className="flex items-center gap-1.5 ml-auto">
          {project.updatedAt && (
            <span className="text-[7px] text-[var(--color-text-muted)] tabular-nums shrink-0">
              {relativeDate(project.updatedAt)}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNavigate(project._id, 'analytics'); }}
            className="text-blue-500 hover:underline font-bold text-[9px]"
          >
            Analytics
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Table row ──────────────────────────────────────────────────────────────

const TableRow = ({ project, accent, reviewCount, overdueCount, canMove, onNavigate, onToggleStar, onMoveClick, isSelected, onSelect }) => (
  <tr
    className={`border-b border-[var(--color-bg-border)] hover:bg-[var(--color-bg-secondary)]/30 cursor-pointer group ${isSelected ? 'bg-[var(--color-action-primary)]/5' : ''}`}
    onClick={() => onNavigate(project._id)}
  >
    <td className="px-2 py-2 w-8" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => onSelect?.(project._id)}>
        {isSelected
          ? <CheckSquare size={13} className="text-[var(--color-action-primary)]" />
          : <Square size={13} className="text-[var(--color-text-muted)]" />}
      </button>
    </td>
    <td className="px-2 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
        <span className="text-xs font-black uppercase tracking-tight truncate group-hover:text-[var(--color-action-primary)] transition-colors">
          {project.name?.toUpperCase()}
        </span>
      </div>
    </td>
    <td className="px-2 py-2 hidden md:table-cell">
      <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase">{project.workspace || 'GENERAL'}</span>
    </td>
    <td className="px-2 py-2">
      <Badge variant={STATUS_VARIANT[project.status] || 'info'} className="!py-0 !px-1.5 !text-[8px]">
        {project.status || 'active'}
      </Badge>
    </td>
    <td className="px-2 py-2 w-28 hidden lg:table-cell">
      <div className="flex items-center gap-1.5">
        <ProgressBar progress={project.progress || 0} className="h-1 flex-1" />
        <span className="text-[8px] tabular-nums text-[var(--color-text-muted)] w-6 text-right">{project.progress || 0}%</span>
      </div>
    </td>
    <td className="px-2 py-2 hidden sm:table-cell">
      <span className="text-[9px] text-[var(--color-text-muted)]">{project.totalTasks || 0}</span>
    </td>
    <td className="px-2 py-2 hidden md:table-cell">
      <MemberAvatars members={project.members} max={3} />
    </td>
    <td className="px-2 py-2 hidden lg:table-cell">
      <span className="text-[9px] text-[var(--color-text-muted)] whitespace-nowrap">{relativeDate(project.updatedAt)}</span>
    </td>
    <td className="px-2 py-2 w-20" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canMove && (
          <button
            onClick={() => onMoveClick?.(project)}
            className="p-1 rounded hover:bg-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)]"
            title="Move to workspace"
          >
            <Move size={12} />
          </button>
        )}
        <button
          onClick={(e) => onToggleStar(e, project)}
          className="p-1 rounded hover:bg-[var(--color-bg-border)]"
          title={project.starred ? 'Unstar' : 'Star'}
        >
          <Star size={12} className={project.starred ? 'fill-amber-400 text-amber-400' : 'text-[var(--color-text-muted)]'} />
        </button>
      </div>
    </td>
  </tr>
);

// ─── ProjectsView ────────────────────────────────────────────────────────────

const PROJECTS_FILTERS_KEY = 'projects-filters';
const PROJECTS_FILTER_DEFAULTS = {
  viewMode: 'workspace',
  filterStatus: 'all',
  filterWorkspace: 'all',
  filterStarred: false,
  sortBy: 'newest',
  searchTerm: '',
};

const ProjectsView = () => {
  const savedFilters = useMemo(() => loadPageFilters(PROJECTS_FILTERS_KEY, PROJECTS_FILTER_DEFAULTS), []);
  const { confirm } = useConfirm();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState(savedFilters.searchTerm || '');
  const [filterStatus, setFilterStatus] = useState(savedFilters.filterStatus || 'all');
  const [filterWorkspace, setFilterWorkspace] = useState(savedFilters.filterWorkspace || 'all');
  const [filterStarred, setFilterStarred] = useState(Boolean(savedFilters.filterStarred));
  const [sortBy, setSortBy] = useState(savedFilters.sortBy || 'newest');
  const [viewMode, setViewMode] = useState(savedFilters.viewMode || 'workspace');
  // Workspace create modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceColor, setNewWorkspaceColor] = useState(PRESET_WORKSPACE_COLORS[0]);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  // Move modal
  const [moveModal, setMoveModal] = useState(null); // { project } | null
  const [moveTarget, setMoveTarget] = useState('');
  // Duplicate modal
  const [dupModal, setDupModal] = useState(null); // { project } | null
  const [dupName, setDupName] = useState('');
  const [dupWorkspace, setDupWorkspace] = useState('GENERAL');
  const [duplicating, setDuplicating] = useState(false);
  // Bulk select
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkMoveTarget, setBulkMoveTarget] = useState('');
  const [bulkMoving, setBulkMoving] = useState(false);
  // Drag
  const [draggingProjectId, setDraggingProjectId] = useState(null);
  const [dragOverWorkspace, setDragOverWorkspace] = useState(null);
  const [draggingWorkspaceName, setDraggingWorkspaceName] = useState(null);
  const workspaceGroupsRef = React.useRef([]);

  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const updateProject = useUpdateProject();

  const { data: projects = [], isLoading: loadingProjects, isError: projectsError, error: projectsErr, refetch: refetchProjects } = useProjects();
  const deferProjectsSecondary = useDeferredQueryEnabled(!loadingProjects);
  const { data: workspaces = [], isLoading: loadingWorkspaces, isError: workspacesError, error: workspacesErr, refetch: refetchWorkspaces } = useWorkspaces(deferProjectsSecondary);
  const { data: reviewTasks = [] } = useReviewTasks(!!user?._id && deferProjectsSecondary);
  const { data: dashboardTasks = [] } = useDashboardTasks(user?._id, !!user?._id && deferProjectsSecondary);

  const navigateToProject = useCallback((projectId, tab) => {
    if (tab === 'analytics') { navigate(`/projects/${projectId}/analytics`); return; }
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
    savePageFilters(PROJECTS_FILTERS_KEY, {
      viewMode,
      filterStatus,
      filterWorkspace,
      filterStarred,
      sortBy,
      searchTerm,
    });
  }, [viewMode, filterStatus, filterWorkspace, filterStarred, sortBy, searchTerm]);

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

  // ── star toggle via useUpdateProject (optimistic) ──
  const toggleStar = useCallback(async (e, project) => {
    e.stopPropagation();
    updateProject.mutate(
      { id: project._id, data: { starred: !project.starred } },
      { onError: () => toast.error('Failed to update star') }
    );
  }, [updateProject, toast]);

  const canMoveProject = useCallback((project) => {
    if (isAdmin) return true;
    const uid = user?._id?.toString();
    if (!uid) return false;
    const ownerId = (project.owner?._id || project.owner)?.toString?.();
    if (ownerId === uid) return true;
    return (project.members || []).some((m) => (m?._id || m)?.toString?.() === uid);
  }, [isAdmin, user]);

  // ── move via useUpdateProject (optimistic + toast) ──
  const moveProjectToWorkspace = useCallback(async (projectId, workspaceName) => {
    if (!projectId || !workspaceName) return;
    const project = projects.find((p) => p._id === projectId);
    if (project && !canMoveProject(project)) return;

    updateProject.mutate(
      { id: projectId, data: { workspace: workspaceName } },
      {
        onSuccess: () => toast.success(`Moved to ${workspaceName}`),
        onError: (err) => toast.error(err.response?.data?.error || 'Failed to move project'),
      }
    );
    setDraggingProjectId(null);
    setDragOverWorkspace(null);
  }, [projects, canMoveProject, updateProject, toast]);

  const handleWorkspaceDrop = useCallback((e, workspaceName) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('application/project-id');
    if (projectId) moveProjectToWorkspace(projectId, workspaceName);
  }, [moveProjectToWorkspace]);

  // ── move modal ──
  const openMoveModal = useCallback((project) => {
    setMoveModal({ project });
    setMoveTarget(project.workspace || 'GENERAL');
  }, []);

  const handleMoveModalConfirm = useCallback(async () => {
    if (!moveModal || !moveTarget || moveTarget === moveModal.project.workspace) {
      setMoveModal(null);
      return;
    }
    const ok = await confirm({
      title: 'Move project?',
      message: `Move "${moveModal.project.name}" from ${moveModal.project.workspace || 'GENERAL'} to ${moveTarget}?`,
      confirmLabel: 'Move',
      type: 'default',
    });
    if (!ok) return;
    moveProjectToWorkspace(moveModal.project._id, moveTarget);
    setMoveModal(null);
  }, [moveModal, moveTarget, confirm, moveProjectToWorkspace]);

  const handleWorkspaceReorder = useCallback(async (sourceIndex, destIndex) => {
    if (sourceIndex === destIndex || sourceIndex < 0 || destIndex < 0) return;
    const reordered = [...workspaceGroupsRef.current];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(destIndex, 0, moved);
    const order = reordered.map((w) => w.name);
    const previousWorkspaces = queryClient.getQueryData(['workspaces']);

    queryClient.setQueryData(['workspaces'], (old = []) => {
      const byName = new Map(old.map((w) => [w.name.toUpperCase(), w]));
      return order.map((name, idx) => {
        const ws = byName.get(name.toUpperCase());
        return ws ? { ...ws, order: idx } : null;
      }).filter(Boolean);
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
  }, [queryClient]);

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
      toast.success('Workspace created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create workspace');
    } finally {
      setCreatingWorkspace(false);
    }
  };

  // ── duplicate project (P2-4) ──
  const openDupModal = useCallback((project) => {
    setDupModal({ project });
    setDupName(project.name + ' (Copy)');
    setDupWorkspace(project.workspace || 'GENERAL');
  }, []);

  const handleDuplicate = async (e) => {
    e.preventDefault();
    if (!dupModal || !dupName.trim()) return;
    setDuplicating(true);
    try {
      const src = dupModal.project;
      await axios.post('/api/projects', {
        name: dupName.trim(),
        workspace: dupWorkspace,
        description: src.description,
        tags: src.tags,
        color: src.color,
        members: (src.members || []).map((m) => ({
          userId: String(m?._id || m),
          role: 'member',
        })),
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDupModal(null);
      toast.success('Project duplicated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to duplicate project');
    } finally {
      setDuplicating(false);
    }
  };

  // ── bulk move (P2-2) ──
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkMove = async () => {
    if (!bulkMoveTarget || selectedIds.size === 0) return;
    const ok = await confirm({
      title: 'Bulk move?',
      message: `Move ${selectedIds.size} project(s) to ${bulkMoveTarget}?`,
      confirmLabel: 'Move All',
      type: 'default',
    });
    if (!ok) return;
    setBulkMoving(true);
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          axios.put(`/api/projects/${id}`, { workspace: bulkMoveTarget })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setSelectedIds(new Set());
      setBulkMoveTarget('');
      toast.success(`Moved ${selectedIds.size} project(s) to ${bulkMoveTarget}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to bulk move projects');
    } finally {
      setBulkMoving(false);
    }
  };

  // ── filter / sort (hooks must run before any early return) ──
  const filteredProjects = useMemo(() => {
    let result = projects.filter((p) => {
      const nameMatch = p.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const tagMatch = p.tags?.some((t) => t?.toLowerCase().includes(searchTerm.toLowerCase()));
      const workspaceMatch = p.workspace?.toLowerCase().includes(searchTerm.toLowerCase());
      const statusMatch = filterStatus === 'all' || p.status === filterStatus;
      const wsMatch = filterWorkspace === 'all' || normalizeWorkspaceKey(p.workspace) === normalizeWorkspaceKey(filterWorkspace);
      const starredMatch = !filterStarred || p.starred;
      return (nameMatch || tagMatch || workspaceMatch) && statusMatch && wsMatch && starredMatch;
    });

    result.sort((a, b) => {
      if (b.starred !== a.starred) return (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'progress-high') return (b.progress || 0) - (a.progress || 0);
      if (sortBy === 'progress-low') return (a.progress || 0) - (b.progress || 0);
      if (sortBy === 'updated') return new Date(b.updatedAt) - new Date(a.updatedAt);
      if (sortBy === 'name') return a.name?.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [projects, searchTerm, filterStatus, filterWorkspace, filterStarred, sortBy]);

  const getWorkspaceColor = useCallback(
    (workspaceName) => resolveWorkspaceColor(workspaceName, workspaces),
    [workspaces]
  );

  const workspaceGroups = useMemo(() => {
    const groups = {};
    workspaces.forEach((w) => { groups[normalizeWorkspaceKey(w.name)] = []; });
    filteredProjects.forEach((project) => {
      const key = normalizeWorkspaceKey(project.workspace || 'General');
      if (!groups[key]) groups[key] = [];
      groups[key].push(project);
    });

    const seen = new Set();
    const orderedNames = [];
    workspaces.forEach((w) => {
      const name = normalizeWorkspaceKey(w.name);
      if (!seen.has(name)) { seen.add(name); orderedNames.push(name); }
    });
    Object.keys(groups).forEach((name) => {
      if (!seen.has(name)) { seen.add(name); orderedNames.push(name); }
    });

    return orderedNames.map((name) => {
      const ws = workspaces.find((w) => normalizeWorkspaceKey(w.name) === name);
      const groupProjects = groups[name] || [];
      return {
        name: ws?.name || name,
        color: getWorkspaceColor(name),
        projects: groupProjects,
        defaultMemberCount: ws?.defaultMembers?.length || 0,
        order: ws?.order ?? 999,
        totalTasks: groupProjects.reduce((s, p) => s + (p.totalTasks || 0), 0),
        totalOverdue: groupProjects.reduce((s, p) => s + (overdueCountByProject[String(p._id)] || 0), 0),
        totalReview: groupProjects.reduce((s, p) => s + (reviewCountByProject[String(p._id)] || 0), 0),
      };
    }).filter((group) => {
      if (isAdmin) return true;
      if (group.projects.length > 0) return true;
      return workspaces.some((w) => normalizeWorkspaceKey(w.name) === normalizeWorkspaceKey(group.name));
    });
  }, [filteredProjects, workspaces, getWorkspaceColor, isAdmin, overdueCountByProject, reviewCountByProject]);

  workspaceGroupsRef.current = workspaceGroups;

  const activeProjectCount = filteredProjects.filter((p) => p.status === 'active').length;
  const showSelect = viewMode === 'all' || viewMode === 'table';

  const workspaceFilterOptions = useMemo(() => [
    { value: 'all', label: 'All Workspaces' },
    ...workspaces.map((w) => ({ value: w.name, label: w.name })),
  ], [workspaces]);

  const activeFilterChips = useMemo(
    () => buildProjectsActiveFilterChips(
      { searchTerm, viewMode, filterWorkspace, filterStatus, filterStarred, sortBy },
      { workspaceOptions: workspaceFilterOptions }
    ),
    [searchTerm, viewMode, filterWorkspace, filterStatus, filterStarred, sortBy, workspaceFilterOptions]
  );

  const handleClearAllFilters = useCallback(() => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterWorkspace('all');
    setFilterStarred(false);
    setSortBy('newest');
    setViewMode('workspace');
  }, []);

  const handleActiveFilterRemove = useCallback((id) => {
    switch (id) {
      case 'searchTerm':
        setSearchTerm('');
        break;
      case 'viewMode':
        setViewMode('workspace');
        break;
      case 'filterWorkspace':
        setFilterWorkspace('all');
        break;
      case 'filterStatus':
        setFilterStatus('all');
        break;
      case 'filterStarred':
        setFilterStarred(false);
        break;
      case 'sortBy':
        setSortBy('newest');
        break;
      default:
        break;
    }
  }, []);

  const projectsFilterFields = useMemo(() => [
    {
      id: 'filterWorkspace',
      label: 'Workspace',
      type: 'searchable',
      value: filterWorkspace,
      defaultValue: 'all',
      options: workspaceFilterOptions,
      onChange: setFilterWorkspace,
    },
    {
      id: 'filterStatus',
      label: 'Status',
      type: 'radio',
      value: filterStatus,
      defaultValue: 'all',
      options: [
        { value: 'all', label: 'All Projects' },
        { value: 'active', label: 'Active Only' },
        { value: 'completed', label: 'Completed' },
        { value: 'archived', label: 'Archived' },
      ],
      onChange: setFilterStatus,
    },
    {
      id: 'filterStarred',
      label: 'Starred',
      type: 'toggle',
      value: filterStarred,
      defaultValue: false,
      toggleLabel: filterStarred ? 'Starred only' : 'All projects',
      onChange: setFilterStarred,
    },
    {
      id: 'sortBy',
      label: 'Sort by',
      type: 'radio',
      value: sortBy,
      defaultValue: 'newest',
      options: [
        { value: 'newest', label: 'Newest First' },
        { value: 'oldest', label: 'Oldest First' },
        { value: 'updated', label: 'Recently Updated' },
        { value: 'progress-high', label: 'Highest Progress' },
        { value: 'progress-low', label: 'Lowest Progress' },
        { value: 'name', label: 'Alphabetical' },
      ],
      onChange: setSortBy,
    },
  ], [filterWorkspace, filterStatus, filterStarred, sortBy, workspaceFilterOptions]);

  if (loading && projects.length === 0) return <PageSkeleton />;

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
      toolbarFill
      filterFields={projectsFilterFields}
      filterSheetTitle="Project filters"
      mobileFilterCount={countActiveFilters(projectsFilterFields) + (searchTerm.trim() ? 1 : 0) + (viewMode !== 'workspace' ? 1 : 0)}
      activeFilterChips={activeFilterChips}
      onActiveFilterRemove={handleActiveFilterRemove}
      onActiveFiltersClear={handleClearAllFilters}
      searchBar={(
        <SearchInput
          variant="toolbar"
          placeholder="Search name, tags, workspace…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-full"
        />
      )}
      toolbar={(
        <>
          {/* View toggle — stays inline (not in filter panel) */}
          <div
            data-mobile-inline
            data-filter-label="View"
            className="tm-toolbar-control inline-flex shrink-0 items-stretch rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-0.5 gap-0.5"
          >
            {[
              { id: 'workspace', icon: LayoutGrid, label: 'Workspaces', short: 'Grid' },
              { id: 'all', icon: List, label: 'All', short: 'All' },
              { id: 'table', icon: Table2, label: 'Table', short: 'Table' },
            ].map(({ id, icon: Icon, label, short }) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewMode(id)}
                title={label}
                className={`inline-flex flex-row items-center justify-center gap-1 px-2.5 h-full min-h-[44px] sm:min-h-0 rounded-[var(--radius-atomic)] text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${viewMode === id
                  ? 'bg-[var(--color-bg-primary)] text-[var(--color-action-primary)] border border-[var(--color-bg-border)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
              >
                <Icon size={12} className="shrink-0" />
                <span className="whitespace-nowrap lg:hidden">{short}</span>
                <span className="whitespace-nowrap hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      toolbarActions={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="tm-toolbar-control flex items-center gap-1.5 shrink-0 !py-0 text-xs min-h-[44px] sm:min-h-0"
          >
            <FolderPlus size={14} />
            Add Workspace
          </Button>
          <Button
            size="sm"
            data-mobile-primary
            onClick={() => navigate('/projects/new')}
            className="tm-toolbar-control flex items-center gap-1.5 shrink-0 !py-0 text-xs min-h-[44px] sm:min-h-0"
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

      {/* Bulk move bar (P2-2) */}
      {selectedIds.size > 0 && (
        <div className="mb-3 p-2.5 rounded-xl border border-[var(--color-action-primary)]/40 bg-[var(--color-action-primary)]/5 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-action-primary)]">
            {selectedIds.size} selected
          </span>
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            <div className="w-44">
              <WorkspaceSelect
                value={bulkMoveTarget}
                onChange={setBulkMoveTarget}
                label=""
                placeholder="Move to workspace…"
              />
            </div>
            <Button size="sm" onClick={handleBulkMove} disabled={!bulkMoveTarget || bulkMoving}>
              {bulkMoving ? 'Moving…' : 'Move All'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col">
        {/* Drag drop zone */}
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

        {/* ── WORKSPACE VIEW ── */}
        {viewMode === 'workspace' && (
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
                    onDragOver={(e) => { e.preventDefault(); setDragOverWorkspace(group.name); }}
                    onDragLeave={() => setDragOverWorkspace(null)}
                    onDrop={(e) => handleWorkspaceDrop(e, group.name)}
                  >
                    <div className="h-1 w-full shrink-0" style={{ backgroundColor: group.color }} />
                    <div
                      className="p-3 space-y-3"
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.types.includes('application/project-id')) setDragOverWorkspace(group.name);
                        else if (e.dataTransfer.types.includes('application/workspace-index')) setDragOverWorkspace(group.name);
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
                          const destIndex = workspaceGroupsRef.current.findIndex((w) => w.name === group.name);
                          handleWorkspaceReorder(Number(workspaceIndex), destIndex);
                        }
                      }}
                    >
                      {/* Workspace header */}
                      <div className="flex items-center justify-between gap-3">
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData(
                              'application/workspace-index',
                              String(workspaceGroupsRef.current.findIndex((w) => w.name === group.name))
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
                            <Badge variant="todo" className="!py-0 !px-2 !text-[8px]" title="Default members">
                              {group.defaultMemberCount} default{group.defaultMemberCount === 1 ? '' : 's'}
                            </Badge>
                          )}
                          {/* P0-5: per-workspace + Project CTA */}
                          <Button
                            variant="ghost"
                            size="xs"
                            className="!p-1 text-[var(--color-action-primary)]"
                            onClick={() => navigate(`/projects/new?workspace=${encodeURIComponent(group.name)}`)}
                            title="Create project in this workspace"
                          >
                            <Plus size={14} />
                          </Button>
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
                                try {
                                  await axios.delete(`/api/projects/workspaces/${group.name}`);
                                  queryClient.invalidateQueries({ queryKey: ['workspaces'] });
                                } catch (err) {
                                  toast.error(err.response?.data?.error || 'Failed to delete workspace');
                                }
                              }}
                              title="Delete workspace"
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* P1-6: workspace header aggregates */}
                      {group.projects.length > 0 && (
                        <div className="flex items-center gap-3 text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                          <span>{group.totalTasks} tasks</span>
                          {group.totalOverdue > 0 && (
                            <span className="text-orange-500">{group.totalOverdue} overdue</span>
                          )}
                          {group.totalReview > 0 && (
                            <span className="text-amber-500">{group.totalReview} in review</span>
                          )}
                        </div>
                      )}

                      {group.projects.length > 0 ? (
                        <div className="grid grid-cols-2 gap-px bg-[var(--color-bg-border)] border-t border-[var(--color-bg-border)]">
                          {group.projects.map((project) => (
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
                              onMoveClick={openMoveModal}
                            />
                          ))}
                        </div>
                      ) : (
                        // P0-6: empty state CTA
                        <EmptyState
                          variant="subtle"
                          title="No projects yet"
                          actionLabel={`Create project in ${group.name}`}
                          onAction={() => navigate(`/projects/new?workspace=${encodeURIComponent(group.name)}`)}
                          className="py-8 border-t border-dashed border-[var(--color-bg-border)]"
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {workspaceGroups.length === 0 && (
              <EmptyState
                icon={Briefcase}
                title="No workspaces found"
                variant="dashed"
                className="col-span-full"
              />
            )}
          </div>
        )}

        {/* ── ALL / TABLE VIEW ── */}
        {(viewMode === 'all' || viewMode === 'table') && (
          <>
            {/* Bulk select header for all/table */}
            {filteredProjects.length > 0 && (
              <div className="mb-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedIds.size === filteredProjects.length) setSelectedIds(new Set());
                    else setSelectedIds(new Set(filteredProjects.map((p) => p._id)));
                  }}
                  className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {selectedIds.size === filteredProjects.length && filteredProjects.length > 0
                    ? <CheckSquare size={12} className="text-[var(--color-action-primary)]" />
                    : <Square size={12} />}
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                </button>
              </div>
            )}

            {viewMode === 'table' ? (
              /* ── TABLE VIEW (P2-1) ── */
              <div className="overflow-x-auto border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
                      <th className="px-2 py-2 w-8" />
                      <th className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Project</th>
                      <th className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hidden md:table-cell">Workspace</th>
                      <th className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Status</th>
                      <th className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hidden lg:table-cell">Progress</th>
                      <th className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hidden sm:table-cell">Tasks</th>
                      <th className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hidden md:table-cell">Members</th>
                      <th className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hidden lg:table-cell">Updated</th>
                      <th className="px-2 py-2 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((project) => (
                      <TableRow
                        key={project._id}
                        project={project}
                        accent={getWorkspaceColor(project.workspace)}
                        reviewCount={reviewCountByProject[String(project._id)] || 0}
                        overdueCount={overdueCountByProject[String(project._id)] || 0}
                        canMove={canMoveProject(project)}
                        onNavigate={navigateToProject}
                        onToggleStar={toggleStar}
                        onMoveClick={openMoveModal}
                        isSelected={selectedIds.has(project._id)}
                        onSelect={toggleSelect}
                      />
                    ))}
                  </tbody>
                </table>
                {filteredProjects.length === 0 && (
                  <EmptyState
                    icon={Briefcase}
                    title="No projects found"
                    actionLabel="Create Project"
                    onAction={() => navigate('/projects/new')}
                    variant="subtle"
                    className="py-16"
                  />
                )}
              </div>
            ) : (
              /* ── ALL PROJECTS GRID ── */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <AnimatePresence>
                  {filteredProjects.map((project, index) => {
                    const accent = getWorkspaceColor(project.workspace);
                    const reviewCount = reviewCountByProject[String(project._id)] || 0;
                    const overdueCount = overdueCountByProject[String(project._id)] || 0;
                    const canMove = canMoveProject(project);
                    const isSelected = selectedIds.has(project._id);
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
                            } ${projectCardAccentClass({ reviewCount, overdueCount })} ${isSelected ? 'ring-1 ring-[var(--color-action-primary)]' : ''}`}
                          style={project.starred ? { borderTopColor: accent, borderTopWidth: 2 } : undefined}
                          onClick={() => navigateToProject(project._id)}
                        >
                          <div className="h-0.5 w-full shrink-0" style={{ backgroundColor: accent }} />

                          <div className="p-3 space-y-3 flex flex-col flex-1">
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  {/* bulk select checkbox (P2-2) */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleSelect(project._id); }}
                                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    {isSelected
                                      ? <CheckSquare size={12} className="text-[var(--color-action-primary)]" />
                                      : <Square size={12} className="text-[var(--color-text-muted)]" />}
                                  </button>
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                                  <h3 className="text-xs font-black uppercase tracking-tight truncate group-hover:text-[var(--color-action-primary)] transition-colors break-words">
                                    {project.name?.toUpperCase()}
                                  </h3>
                                </div>
                                <p className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-widest mt-1 pl-3.5">
                                  {(project.workspace || 'General').toUpperCase()}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <ProjectCardStatusOverlay reviewCount={reviewCount} overdueCount={overdueCount} />
                                {/* drag grip */}
                                {canMove && (
                                  <div
                                    draggable
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      e.dataTransfer.setData('application/project-id', project._id);
                                      e.dataTransfer.effectAllowed = 'move';
                                      setDraggingProjectId(project._id);
                                    }}
                                    onDragEnd={(e) => { e.stopPropagation(); setDraggingProjectId(null); }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="cursor-grab active:cursor-grabbing p-1 rounded-lg hover:bg-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] opacity-60 group-hover:opacity-100 transition-all"
                                    title="Drag to move workspace"
                                  >
                                    <GripVertical size={14} />
                                  </div>
                                )}
                                {/* P0-4: status badge (all view) */}
                                <Badge variant={STATUS_VARIANT[project.status] || 'info'} className="!py-0 !px-1.5 !text-[8px]">
                                  {project.status || 'Active'}
                                </Badge>
                                <button
                                  onClick={(e) => toggleStar(e, project)}
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

                            {/* P1-1: member avatars */}
                            {(project.members?.length > 0) && (
                              <div className="flex items-center gap-1.5">
                                <Users size={10} className="text-[var(--color-text-muted)] shrink-0" />
                                <MemberAvatars members={project.members} max={4} />
                                <span className="text-[8px] text-[var(--color-text-muted)]">{project.members.length}</span>
                              </div>
                            )}

                            <div className="space-y-1 mt-auto">
                              <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                                <span>Progress · <span className="normal-case">{project.totalTasks || 0} tasks</span></span>
                                <span className="tabular-nums">{project.progress || 0}%</span>
                              </div>
                              <ProgressBar progress={project.progress || 0} className="h-1" />
                              <div className="flex items-center justify-between">
                                {/* P1-2: updatedAt */}
                                {project.updatedAt && (
                                  <span className="text-[8px] text-[var(--color-text-muted)] tabular-nums">
                                    {relativeDate(project.updatedAt)}
                                  </span>
                                )}
                                <div className="flex items-center gap-1 ml-auto">
                                  {canMove && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); openMoveModal(project); }}
                                      className="text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)] p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                                      title="Move to workspace"
                                    >
                                      <Move size={11} />
                                    </button>
                                  )}
                                  {/* P2-4: duplicate */}
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openDupModal(project); }}
                                    className="text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)] p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                                    title="Duplicate project"
                                  >
                                    <Copy size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); navigateToProject(project._id, 'analytics'); }}
                                    className="text-blue-500 hover:underline font-bold text-[9px]"
                                  >
                                    Analytics
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* P0-6: empty state */}
                {filteredProjects.length === 0 && (
                  <EmptyState
                    icon={Briefcase}
                    title="No projects found"
                    actionLabel={filterWorkspace !== 'all' ? `Create project in ${filterWorkspace}` : 'Create Project'}
                    onAction={() => navigate(filterWorkspace !== 'all' ? `/projects/new?workspace=${encodeURIComponent(filterWorkspace)}` : '/projects/new')}
                    variant="dashed"
                    className="col-span-full"
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create Workspace Modal ── */}
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
            <WorkspaceColorPicker value={newWorkspaceColor} onChange={setNewWorkspaceColor} />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={creatingWorkspace || !newWorkspaceName.trim()}>
              {creatingWorkspace ? 'Creating...' : 'Create Workspace'}
            </Button>
          </div>
        </form>
      </NexusModal>

      {/* ── Move Project Modal (P0-2) ── */}
      <NexusModal
        isOpen={!!moveModal}
        onClose={() => setMoveModal(null)}
        title={`Move "${moveModal?.project?.name || ''}"`}
        size="sm"
        showFooter={false}
      >
        {moveModal && (
          <div className="space-y-4">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-bold">
              Current: {moveModal.project.workspace || 'GENERAL'}
            </p>
            <WorkspaceSelect
              value={moveTarget}
              onChange={setMoveTarget}
              label="Move to workspace"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setMoveModal(null)}>Cancel</Button>
              <Button
                type="button"
                disabled={!moveTarget || moveTarget === moveModal.project.workspace}
                onClick={handleMoveModalConfirm}
              >
                Move
              </Button>
            </div>
          </div>
        )}
      </NexusModal>

      {/* ── Duplicate Project Modal (P2-4) ── */}
      <NexusModal
        isOpen={!!dupModal}
        onClose={() => setDupModal(null)}
        title="Duplicate Project"
        size="sm"
        showFooter={false}
      >
        {dupModal && (
          <form onSubmit={handleDuplicate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">New Project Name</label>
              <Input
                value={dupName}
                onChange={(e) => setDupName(e.target.value)}
                placeholder="Project name"
                className="!py-2.5 !text-xs font-bold uppercase"
                required
              />
            </div>
            <WorkspaceSelect value={dupWorkspace} onChange={setDupWorkspace} label="Workspace" />
            <p className="text-[9px] text-[var(--color-text-muted)]">
              Copies name, workspace, members, tags, and color. Tasks are not cloned.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setDupModal(null)}>Cancel</Button>
              <Button type="submit" disabled={duplicating || !dupName.trim()}>
                {duplicating ? 'Duplicating...' : 'Duplicate'}
              </Button>
            </div>
          </form>
        )}
      </NexusModal>
    </ListPageLayout>
  );
};

export default ProjectsView;
