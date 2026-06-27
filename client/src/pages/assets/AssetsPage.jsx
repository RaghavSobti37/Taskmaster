import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Link2, Edit2, Plus, Trash2, Database,
  Shield, RefreshCw, Cloud, StickyNote
} from 'lucide-react';
import {
  detectAssetType,
  AssetTypeIconBadge,
  assetStatIcon,
  ASSET_TYPE_FILTER_OPTIONS,
  ASSET_TYPE_FORM_OPTIONS,
  GOOGLE_WORKSPACE_SHORTCUTS,
} from '../../components/assets/assetTypeIcons';
import ProjectMultiSelect from '../../components/forms/ProjectMultiSelect';
import { filterProjectsByWorkspace } from '../../components/forms/WorkspaceProjectFields';
import { WorkspaceDot } from '../../components/forms/WorkspaceSelect';
import { useAuth } from '../../contexts/AuthContext';
import {
  useWorkspaces,
  useProjects,
  useAssets,
  useGoogleAccounts,
  useCreateAsset,
  useUpdateAsset,
  useDeleteAsset,
  useUnlinkGoogleAccount,
  refreshGoogleAccounts,
} from '../../hooks/useTaskmasterQueries';
import { getWorkspaceColor } from '../../utils/workspaceColors';
import { NexusDropdown, Button, Input, Badge, PageSkeleton, SearchInput, TablePagination, ListPageLayout, UserLabel, ListCard, MobileCollapsibleSection, DEFAULT_TABLE_PAGE_SIZE, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import { NexusModal, ModalShell, ModalHeader, ModalBody, ModalFooter } from '../../components/ui/modals';;
import { distributionFromField } from '../../utils/buildChartSeries';
import { format } from 'date-fns';
import { assetMatchesSearch } from '../../utils/assetSearch';
import MentionTextarea from '../../components/mentions/MentionTextarea';
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';

const EMPTY_ASSET_FORM = { projectIds: [], name: '', link: '', type: 'other', notes: '' };

const openAssetLink = (link) => {
  const trimmed = link?.trim();
  if (!trimmed) return;
  const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

const AssetsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    data: assets = [],
    isLoading: loadingAssets,
    isError: assetsError,
    error: assetsErr,
    refetch: refetchAssets,
  } = useAssets();
  const deferAssetsSecondary = useDeferredQueryEnabled(!loadingAssets);
  const { data: workspaces = [] } = useWorkspaces(deferAssetsSecondary);
  const {
    data: projects = [],
    isLoading: loadingProjects,
    isError: projectsError,
    error: projectsErr,
    refetch: refetchProjects,
  } = useProjects(deferAssetsSecondary);
  const { data: googleAccounts = [] } = useGoogleAccounts(deferAssetsSecondary);
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();
  const unlinkGoogleAccount = useUnlinkGoogleAccount();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [simEmail, setSimEmail] = useState('');
  const [linking, setLinking] = useState(false);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newAsset, setNewAsset] = useState(EMPTY_ASSET_FORM);
  const [editingAsset, setEditingAsset] = useState(null);
  const [assetEditBaseline, setAssetEditBaseline] = useState(null);

  const [deleteModal, setDeleteModal] = useState({ open: false, assetId: null });

  useEffect(() => {
    if (searchParams.get('add') === '1') setIsDrawerOpen(true);
  }, [searchParams]);

  const loading = loadingAssets || loadingProjects;
  const listQueryError = assetsError ? assetsErr : projectsError ? projectsErr : null;
  const handleListRetry = () => {
    if (assetsError) refetchAssets();
    if (projectsError) refetchProjects();
  };
  const submitting = createAsset.isPending || updateAsset.isPending;

  const hasAssetEdits =
    !!editingAsset && !!assetEditBaseline && !stableJsonEqual(newAsset, assetEditBaseline);

  const { revert: revertAssetEdits } = useUnsavedChanges({
    baseline: assetEditBaseline,
    draft: newAsset,
    setDraft: setNewAsset,
    hasChanges: isDrawerOpen && hasAssetEdits,
    onSave: () => handleAddAsset(),
    enabled: false,
    isSaving: submitting,
  });

  const handleAddAsset = async (e) => {
    if (e) e.preventDefault();
    if (!newAsset.name || !newAsset.link) return;

    const payload = {
      projectIds: newAsset.projectIds,
      name: newAsset.name,
      link: newAsset.link.trim(),
      type: newAsset.type || 'other',
      notes: newAsset.notes?.trim() || '',
    };

    try {
      if (editingAsset) {
        await updateAsset.mutateAsync({ id: editingAsset._id, payload });
        setIsDrawerOpen(false);
        setEditingAsset(null);
        setAssetEditBaseline(null);
        setNewAsset(EMPTY_ASSET_FORM);
      } else {
        await createAsset.mutateAsync(payload);
        setIsDrawerOpen(false);
        setNewAsset(EMPTY_ASSET_FORM);
      }
    } catch (err) {
      console.error('Save asset error:', err);
    }
  };

  const handleDeleteAsset = async () => {
    const { assetId } = deleteModal;
    try {
      await deleteAsset.mutateAsync(assetId);
      setDeleteModal({ open: false, assetId: null });
      setIsDrawerOpen(false);
      setEditingAsset(null);
    } catch (err) {
      console.error('Delete asset error:', err);
    }
  };

  const handleUnlinkAccount = async (id) => {
    try {
      await unlinkGoogleAccount.mutateAsync(id);
    } catch (err) {
      console.error('Failed to unlink account:', err);
    }
  };

  const handleSimulateConnect = async (e) => {
    if (e) e.preventDefault();
    const emails = simEmail.split(/[\n,;]+/).map((v) => v.trim()).filter(Boolean);
    if (!emails.length || emails.some((email) => !email.includes('@'))) return;
    setLinking(true);
    try {
      await axios.post('/api/google/accounts/manual', { emails: emails.join(',') });
      await refreshGoogleAccounts(queryClient);
      setIsLinkModalOpen(false);
      setSimEmail('');
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        try {
          for (const email of emails) {
            await axios.post('/api/google/accounts/simulate', { email });
          }
          await refreshGoogleAccounts(queryClient);
          setIsLinkModalOpen(false);
          setSimEmail('');
        } catch (simErr) {
          console.error('Failed to link accounts:', simErr);
        }
      } else {
        console.error('Failed to link accounts:', err);
      }
    } finally {
      setLinking(false);
    }
  };

  const handleOAuthConnect = () => {
    window.location.href = `/api/auth/google?state=link_${user?._id}`;
  };

  const getDetectedType = (asset) => detectAssetType(asset.type, asset.link);

  const assetTypeCounts = useMemo(() => {
    const counts = { drive: 0, sheet: 0, docs: 0, zoom: 0 };
    for (const asset of assets) {
      const detected = detectAssetType(asset.type, asset.link);
      if (detected in counts) counts[detected] += 1;
    }
    return counts;
  }, [assets]);

  const typeChartData = useMemo(
    () =>
      distributionFromField(assets, 'type', {
        labelFn: (_, row) => {
          const detected = detectAssetType(row?.type, row?.link);
          return detected === 'other' ? 'Other' : detected.charAt(0).toUpperCase() + detected.slice(1);
        },
      }),
    [assets]
  );

  const googleServiceUrl = (service, index, email) => {
    if (service.type === 'meet') return `https://meet.google.com/?authuser=${email}`;
    if (service.type === 'drive') return `https://drive.google.com/drive/u/${index}/`;
    return `https://docs.google.com/${service.path}/u/${index}/`;
  };

  const workspaceFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Workspaces' },
      ...workspaces.map((w) => ({ value: w.name, label: w.name })),
    ],
    [workspaces]
  );

  const projectFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All Projects' },
      ...filterProjectsByWorkspace(projects, workspaceFilter).map((p) => ({ value: p._id, label: p.name })),
    ],
    [projects, workspaceFilter]
  );

  const filteredAssets = useMemo(() => {
    let list = assets.filter((a) => {
      const matchesSearch = assetMatchesSearch(a, searchTerm, { includeProjectNames: true });
      const matchesWorkspace = workspaceFilter === 'all'
        || (a.projectIds || []).some((p) => {
          const pid = p._id || p;
          const project = projects.find((pr) => String(pr._id) === String(pid));
          return project && String(project.workspace || 'General').toUpperCase() === String(workspaceFilter).toUpperCase();
        });
      const matchesProject = projectFilter === 'all'
        || (a.projectIds || []).some((p) => String(p._id || p) === String(projectFilter));
      const matchesType = typeFilter === 'all' || getDetectedType(a) === typeFilter;
      return matchesSearch && matchesWorkspace && matchesProject && matchesType;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'project') {
        const aProject = (a.projectIds?.[0]?.name || 'ZZZ').toUpperCase();
        const bProject = (b.projectIds?.[0]?.name || 'ZZZ').toUpperCase();
        return aProject.localeCompare(bProject);
      }
      if (sortBy === 'type') return getDetectedType(a).localeCompare(getDetectedType(b));
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return list;
  }, [assets, searchTerm, workspaceFilter, projectFilter, typeFilter, sortBy, projects]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, workspaceFilter, projectFilter, typeFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [filteredAssets, currentPage, pageSize]);

  const renderProjectCell = (projectIds) => {
    if (!projectIds?.length) {
      return <Badge variant="slate" className="text-[8px] shrink-0">ROOT</Badge>;
    }
    const visible = projectIds.slice(0, 2);
    const extra = projectIds.length - visible.length;
    const allNames = projectIds.map((p) => p.name).join(', ');
    return (
      <div className="flex items-center gap-1 min-w-0 w-full whitespace-nowrap overflow-hidden">
        {visible.map((project) => {
          const color = getWorkspaceColor(project.workspace, workspaces);
          return (
            <span
              key={project._id || project.name}
              className="inline-flex items-center gap-1 min-w-0 max-w-[calc(50%-0.5rem)] pl-1.5 pr-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tight bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]"
              style={{ borderLeft: `3px solid ${color}` }}
              title={allNames}
            >
              <WorkspaceDot color={color} className="!w-1.5 !h-1.5" />
              <span className="truncate">{project.name}</span>
            </span>
          );
        })}
        {extra > 0 && (
          <span className="text-[8px] font-black text-[var(--color-text-muted)] shrink-0" title={allNames}>
            +{extra}
          </span>
        )}
      </div>
    );
  };

  if (loading && assets.length === 0) return <PageSkeleton />;

  const openAddDrawer = () => {
    setEditingAsset(null);
    setNewAsset(EMPTY_ASSET_FORM);
    setIsDrawerOpen(true);
  };

  return (
    <ListPageLayout
      containerClassName="!py-4"
      overviewMobileMaxStats={3}
      overview={{
        stats: [
          {
            id: 'all',
            label: 'Total Files',
            value: assets.length,
            icon: Database,
            variant: 'info',
            onClick: () => setTypeFilter('all'),
            active: typeFilter === 'all',
          },
          {
            id: 'drive',
            label: 'Drive',
            value: assetTypeCounts.drive,
            icon: assetStatIcon('drive'),
            variant: 'mint',
            onClick: () => setTypeFilter('drive'),
            active: typeFilter === 'drive',
          },
          {
            id: 'sheet',
            label: 'Sheets',
            value: assetTypeCounts.sheet,
            icon: assetStatIcon('sheet'),
            variant: 'apricot',
            onClick: () => setTypeFilter('sheet'),
            active: typeFilter === 'sheet',
          },
          {
            id: 'docs',
            label: 'Docs',
            value: assetTypeCounts.docs,
            icon: assetStatIcon('docs'),
            variant: 'slate',
            onClick: () => setTypeFilter('docs'),
            active: typeFilter === 'docs',
          },
        ],
       
      }}
      toolbar={
        <>
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter assets..."
            className="tm-toolbar-search--grow"
          />
          <div className="flex flex-nowrap items-center gap-2 shrink-0">
            <NexusDropdown
              options={workspaceFilterOptions}
              value={workspaceFilter}
              onChange={(value) => {
                setWorkspaceFilter(value);
                setProjectFilter('all');
              }}
              placeholder="Workspace"
              className="!w-32 shrink-0"
            />
            <NexusDropdown
              options={projectFilterOptions}
              value={projectFilter}
              onChange={setProjectFilter}
              placeholder="Project"
              className="!w-32 shrink-0"
            />
            <NexusDropdown
              options={ASSET_TYPE_FILTER_OPTIONS}
              value={typeFilter}
              onChange={setTypeFilter}
              placeholder="File type"
              className="!w-28 shrink-0"
            />
            <NexusDropdown
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'name', label: 'Name' },
                { value: 'project', label: 'Project' },
                { value: 'type', label: 'File Type' },
              ]}
              value={sortBy}
              onChange={setSortBy}
              placeholder="Sort"
              className="!w-28 shrink-0"
            />
          </div>
        </>
      }
      toolbarActions={
        <Button size="sm" onClick={openAddDrawer}>
          <Plus size={14} /> Add asset
        </Button>
      }
    >
      {listQueryError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(listQueryError, 'Failed to load assets')}
          onRetry={handleListRetry}
        />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-9 space-y-6 min-w-0">
           {/* Mobile card list */}
           <div className="lg:hidden space-y-3">
             {filteredAssets.length === 0 ? (
               <div className="py-16 text-center opacity-40 border border-[var(--color-bg-border)]">
                 <Database size={40} className="mx-auto mb-3" />
                 <p className="text-[10px] font-black uppercase tracking-widest">No files uploaded yet</p>
               </div>
             ) : paginatedAssets.map((asset) => {
               const hasLink = Boolean(asset.link?.trim());
               return (
                 <ListCard
                   key={asset._id}
                   onClick={() => { if (hasLink) openAssetLink(asset.link); }}
                   primary={
                     <div className="flex items-center gap-2 min-w-0">
                       <AssetTypeIconBadge type={asset.type} link={asset.link} size={14} className="shrink-0" />
                       <span className="text-sm font-bold truncate">{asset.name}</span>
                     </div>
                   }
                   trailing={
                     <span className="text-[10px] font-bold text-[var(--color-text-muted)] tabular-nums">
                       {format(new Date(asset.createdAt), 'MMM d')}
                     </span>
                   }
                   meta={renderProjectCell(asset.projectIds)}
                   actions={
                     <Button
                       type="button"
                       size="sm"
                       variant="secondary"
                       className="w-full min-h-[44px]"
                       onClick={(e) => {
                         e.stopPropagation();
                         const loaded = {
                           projectIds: (asset.projectIds || []).map((p) => p._id || p),
                           name: asset.name,
                           link: asset.link,
                           type: asset.type || 'other',
                           notes: asset.notes || '',
                         };
                         setEditingAsset(asset);
                         setNewAsset(loaded);
                         setAssetEditBaseline(cloneSnapshot(loaded));
                         setIsDrawerOpen(true);
                       }}
                     >
                       <Edit2 size={14} /> Edit
                     </Button>
                   }
                 />
               );
             })}
             {filteredAssets.length > 0 && (
               <TablePagination
                 pageSize={pageSize}
                 currentPage={currentPage}
                 totalPages={totalPages}
                 totalItems={filteredAssets.length}
                 rowCount={paginatedAssets.length}
                 onPageChange={setCurrentPage}
                 onPageSizeChange={(size) => {
                   setPageSize(size);
                   setCurrentPage(1);
                 }}
               />
             )}
           </div>

           <div className="overflow-visible hidden lg:block border-t border-[var(--color-bg-border)]">
              <div className="min-w-0 pr-1 sm:pr-2">
                 <table className="w-full max-w-full text-left table-fixed">
                    <colgroup>
                      <col style={{ width: '38%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '27%' }} />
                      <col style={{ width: '17%' }} className="hidden sm:table-column" />
                      <col style={{ width: '7%' }} />
                    </colgroup>
                    <thead className="bg-[var(--color-bg-workspace)]/50 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] border-b border-[var(--color-bg-border)]">
                       <tr>
                          <th className="pl-2 sm:pl-3 pr-1 py-2">File Name</th>
                          <th className="px-1.5 sm:px-2 py-2 whitespace-nowrap">Date</th>
                          <th className="px-2 sm:px-3 py-2">Projects</th>
                          <th className="px-2 sm:px-3 py-2 hidden sm:table-cell">Added By</th>
                          <th className="px-1.5 py-2 text-center whitespace-nowrap">Edit</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-bg-border)]">
                       {filteredAssets.length === 0 ? (
                         <tr>
                            <td colSpan="5" className="py-20 text-center opacity-20">
                               <Database size={48} className="mx-auto mb-4" />
                               <p className="text-[10px] font-black uppercase tracking-widest">No files uploaded yet</p>
                            </td>
                         </tr>
                       ) : paginatedAssets.map((asset) => {
                         const formattedDate = format(new Date(asset.createdAt), 'MMM d, yy');
                         const hasLink = Boolean(asset.link?.trim());
                         return (
                           <tr 
                             key={asset._id} 
                             onClick={() => { if (hasLink) openAssetLink(asset.link); }}
                             className={`group hover:bg-[var(--color-bg-secondary)]/50 transition-all ${hasLink ? 'cursor-pointer' : ''}`}
                           >
                             
                              <td className="pl-2 sm:pl-3 pr-1 py-2 max-w-0 whitespace-nowrap">
                                 <div className="flex items-center gap-2 min-w-0">
                                    <AssetTypeIconBadge type={asset.type} link={asset.link} size={14} className="shrink-0" />
                                    <p
                                      className="text-[10px] sm:text-[11px] font-black text-[var(--color-text-primary)] truncate min-w-0"
                                      title={asset.name}
                                    >
                                      {asset.name}
                                    </p>
                                 </div>
                              </td>
                              <td className="px-1.5 sm:px-2 py-2 max-w-0 whitespace-nowrap align-middle">
                                 <span
                                   className="text-[9px] sm:text-[10px] font-bold text-[var(--color-text-muted)] truncate block tabular-nums"
                                   title={format(new Date(asset.createdAt), 'MMM dd, yyyy')}
                                 >
                                   {formattedDate}
                                 </span>
                              </td>
                              <td className="px-2 sm:px-3 py-2 max-w-0 whitespace-nowrap">
                                 {renderProjectCell(asset.projectIds)}
                              </td>
                              <td className="px-2 sm:px-3 py-2 max-w-0 whitespace-nowrap hidden sm:table-cell">
                                 {asset.createdBy ? (
                                   <UserLabel
                                     user={asset.createdBy}
                                     size="xs"
                                     nameClassName="text-[10px] font-bold text-[var(--color-text-secondary)] truncate"
                                   />
                                 ) : (
                                   <span className="text-[9px] italic opacity-30">N/A</span>
                                 )}
                              </td>
                              <td className="px-1.5 py-2 text-center align-middle whitespace-nowrap">
                                 <Button
                                   type="button"
                                   size="xs"
                                   variant="secondary"
                                   title="Edit asset"
                                   className="gap-1 shrink-0 mx-auto !px-2"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     const loaded = {
                                       projectIds: (asset.projectIds || []).map((p) => p._id || p),
                                       name: asset.name,
                                       link: asset.link,
                                       type: asset.type || 'other',
                                       notes: asset.notes || '',
                                     };
                                     setEditingAsset(asset);
                                     setNewAsset(loaded);
                                     setAssetEditBaseline(cloneSnapshot(loaded));
                                     setIsDrawerOpen(true);
                                   }}
                                 >
                                   <Edit2 size={12} aria-hidden />
                                   Edit
                                 </Button>
                              </td>
                           </tr>
                         );
                       })}
                    </tbody>
                 </table>
              </div>
              {filteredAssets.length > 0 && (
                <TablePagination
                  pageSize={pageSize}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredAssets.length}
                  rowCount={paginatedAssets.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                />
              )}
           </div>
        </div>

        <aside className="lg:col-span-3 space-y-6 min-w-0">
           <MobileCollapsibleSection title="Connected accounts">
           <section className="p-4 space-y-4 border-b border-[var(--color-bg-border)]">
              <div className="flex items-center justify-between">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
                    <Cloud size={14} /> Google Workspace
                 </h4>
                 <Button 
                   size="xs"
                   onClick={() => setIsLinkModalOpen(true)}
                   className="!px-3 !py-2 !text-[9px] font-black uppercase tracking-widest"
                 >
                    <Plus size={12} /> Link Account
                 </Button>
              </div>

              {/* Linked Accounts with clickable icons for each */}
              <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                {googleAccounts.length === 0 ? (
                   <p className="text-[9px] text-[var(--color-text-muted)] italic text-center py-4">No Google accounts linked yet.</p>
                ) : googleAccounts.map((acc, index) => (
                   <div key={acc._id} className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] space-y-3 relative group">
                      {/* Header with Account Details & Unlink Trigger */}
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
                               <Cloud size={14} />
                            </div>
                            <div className="min-w-0">
                               <p className="text-[10px] font-black uppercase tracking-tight truncate leading-none text-[var(--color-text-primary)]">{acc.email.split('@')[0]}</p>
                               <p className="text-[8px] text-[var(--color-text-muted)] truncate mt-0.5">{acc.email}</p>
                            </div>
                         </div>
                         <button 
                           onClick={() => handleUnlinkAccount(acc._id)}
                           className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                           title="Unlink Account"
                         >
                            <Trash2 size={12} />
                         </button>
                      </div>

                      {/* Set of Clickable Google Workspace Service Icons */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {GOOGLE_WORKSPACE_SHORTCUTS.map((service) => (
                            <a 
                              key={service.name} 
                              href={googleServiceUrl(service, index, acc.email)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-col items-center justify-center p-1.5 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/40 hover:bg-[var(--color-bg-surface)] hover:border-[var(--color-action-primary)]/30 transition-all relative group" 
                              title={`Open Google ${service.name}`}
                            >
                              <AssetTypeIconBadge type={service.type} size={12} className="!p-0.5 mb-0.5" />
                              <span className="text-[7px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">{service.name}</span>
                              <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
                            </a>
                        ))}
                      </div>
                   </div>
                ))}
              </div>
           </section>
           </MobileCollapsibleSection>

           <section className="p-4 border border-[var(--color-bg-border)] relative overflow-hidden">
              <div className="relative z-10 space-y-3">
                 <div className="flex items-center justify-between">
                    <h4 className="tm-widget-label text-blue-400">Storage Security</h4>
                    <Shield size={14} className="text-emerald-500" />
                 </div>
                 <div className="p-2.5 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)]">
                    <p className="text-[10px] font-bold italic tm-data-meta">All registered assets are saved as secure external references.</p>
                 </div>
              </div>
           </section>
        </aside>
      </div>

      <ModalShell isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} size="lg">
        <ModalHeader title={editingAsset ? 'Edit Asset Details' : 'Add Link Asset'} onClose={() => setIsDrawerOpen(false)} />
        <ModalBody>
          <form onSubmit={handleAddAsset} className="space-y-6">
            <div className="space-y-4">
              <Input label="Asset Title / Name" value={newAsset.name} onChange={e => setNewAsset({ ...newAsset, name: e.target.value })} placeholder="E.g., Production API Key / File Name" icon={Database} required />
              <Input
                label="Asset URL Link"
                value={newAsset.link}
                onChange={(e) => {
                  const link = e.target.value;
                  setNewAsset({ ...newAsset, link, type: detectAssetType('other', link) });
                }}
                placeholder="https://..."
                icon={Link2}
                required
              />

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Asset Type</label>
                <NexusDropdown
                  options={ASSET_TYPE_FORM_OPTIONS}
                  value={newAsset.type}
                  onChange={(val) => setNewAsset({ ...newAsset, type: val })}
                  placeholder="Select Asset Type"
                />
              </div>

              <ProjectMultiSelect
                projects={projects}
                value={newAsset.projectIds || []}
                onChange={(val) => setNewAsset({ ...newAsset, projectIds: Array.isArray(val) ? val : [val].filter(Boolean) })}
                label="Associated Projects"
                placeholder="Select projects..."
              />

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1 flex items-center gap-1.5">
                  <StickyNote size={10} className="text-[var(--color-action-primary)]" />
                  Notes
                </label>
                <p className="text-[9px] text-[var(--color-text-muted)] ml-1">Private to this asset — not shown in the file list.</p>
                <MentionTextarea
                  value={newAsset.notes || ''}
                  onChange={(notes) => setNewAsset({ ...newAsset, notes })}
                  placeholder="e.g. follow up with @Name with #Asset Name — @ notifies, # links to asset URL"
                  rows={4}
                  className="w-full min-h-[88px] px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-action-primary)]/50 resize-y"
                />
              </div>
            </div>
            {!editingAsset && (
              <Button type="submit" className="w-full" disabled={submitting || !newAsset.name || !newAsset.link}>
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <><Plus size={14} /> Add Asset</>}
              </Button>
            )}
          </form>
        </ModalBody>
        {editingAsset && (
          <ModalFooter className="justify-between">
            <Button
              type="button"
              variant="ghost"
              className="!text-rose-500 hover:!bg-rose-500/10"
              onClick={() => setDeleteModal({ open: true, assetId: editingAsset._id })}
            >
              Delete Asset
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={revertAssetEdits}
                disabled={!hasAssetEdits || submitting}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="success"
                onClick={() => handleAddAsset()}
                disabled={!hasAssetEdits || submitting}
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </ModalFooter>
        )}
      </ModalShell>

      <ModalShell isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} size="lg">
        <ModalHeader title="Link Google Account" onClose={() => setIsLinkModalOpen(false)} icon={Cloud} iconStyle={{ color: '#3b82f6' }} />
        <ModalBody className="space-y-4">
          <p className="text-[10px] text-[var(--color-text-muted)] -mt-2">Link Google accounts to access Drive, Sheets, Docs, and Meet resources.</p>

          <button
            type="button"
            onClick={handleOAuthConnect}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[var(--radius-atomic)] text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
          >
            <Cloud size={14} /> Connect via Google OAuth
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-[var(--color-bg-border)]" />
            <span className="flex-shrink mx-3 text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Or type emails</span>
            <div className="flex-grow border-t border-[var(--color-bg-border)]" />
          </div>

          <form onSubmit={handleSimulateConnect} className="space-y-3">
            <textarea
              value={simEmail}
              onChange={(e) => setSimEmail(e.target.value)}
              placeholder="Enter one or more Google emails (comma or newline separated)..."
              className="w-full min-h-[96px] bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] px-4 py-2.5 text-xs font-bold outline-none text-[var(--color-text-primary)] resize-y"
              required
            />
            <button
              type="submit"
              disabled={linking || !simEmail}
              className="w-full py-2.5 bg-[var(--color-action-primary)] hover:opacity-90 text-white rounded-[var(--radius-atomic)] text-[10px] font-black uppercase tracking-widest transition-all"
            >
              {linking ? 'Saving...' : 'Save Linked Emails'}
            </button>
          </form>
        </ModalBody>
      </ModalShell>

      <NexusModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, assetId: null })}
        title="Delete File"
        message="Are you sure you want to delete this file? This cannot be undone."
        type="danger"
        isConfirm
        confirmLabel="Delete"
        onConfirm={handleDeleteAsset}
      />
    </ListPageLayout>
  );
};

export default AssetsPage;


// Performance Optimization: useCallback(eventHandler) memoization guard
