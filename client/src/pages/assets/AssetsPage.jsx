import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
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
import { WorkspaceDot } from '../../components/forms/WorkspaceSelect';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspaces } from '../../hooks/useTaskmasterQueries';
import { getWorkspaceColor } from '../../utils/workspaceColors';
import { 
  NexusModal, NexusDropdown,
  PageContainer, Card, Button, Input, StatCard, Badge, 
  PageSkeleton, ModalShell, ModalHeader, ModalBody, SearchInput, TablePagination
} from '../../components/ui';
import { format } from 'date-fns';
import { assetMatchesSearch } from '../../utils/assetSearch';
import MentionTextarea from '../../components/mentions/MentionTextarea';

const EMPTY_ASSET_FORM = { projectIds: [], name: '', link: '', type: 'other', notes: '' };

const openAssetLink = (link) => {
  const trimmed = link?.trim();
  if (!trimmed) return;
  const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

const AssetsPage = () => {
  const { user } = useAuth();
  const { data: workspaces = [] } = useWorkspaces();
  const [searchParams] = useSearchParams();
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Google account link states
  const [googleAccounts, setGoogleAccounts] = useState([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [simEmail, setSimEmail] = useState('');
  const [linking, setLinking] = useState(false);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newAsset, setNewAsset] = useState(EMPTY_ASSET_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);

  const [deleteModal, setDeleteModal] = useState({ open: false, assetId: null });

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (searchParams.get('add') === '1') setIsDrawerOpen(true);
  }, [searchParams]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assetsRes, projectsRes, googleRes] = await Promise.all([
        axios.get('/api/assets'),
        axios.get('/api/projects'),
        axios.get('/api/google/accounts').catch(() => ({ data: [] }))
      ]);
      setAssets(assetsRes.data);
      setProjects(projectsRes.data);
      setGoogleAccounts(googleRes.data);
    } catch (err) {
      console.error('Error fetching assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsset = async (e) => {
    if (e) e.preventDefault();
    if (!newAsset.name || !newAsset.link) return;

    setSubmitting(true);
    try {
      if (editingAsset) {
        const res = await axios.put(`/api/assets/${editingAsset._id}`, {
          projectIds: newAsset.projectIds,
          name: newAsset.name,
          link: newAsset.link.trim(),
          type: newAsset.type || 'other',
          notes: newAsset.notes?.trim() || ''
        });
        setAssets(assets.map(a => a._id === editingAsset._id ? res.data : a));
        setIsDrawerOpen(false);
        setEditingAsset(null);
        setNewAsset(EMPTY_ASSET_FORM);
      } else {
        const res = await axios.post('/api/assets', {
          projectIds: newAsset.projectIds,
          name: newAsset.name,
          link: newAsset.link.trim(),
          type: newAsset.type || 'other',
          notes: newAsset.notes?.trim() || ''
        });
        setAssets([res.data, ...assets]);
        setIsDrawerOpen(false);
        setNewAsset(EMPTY_ASSET_FORM);
      }
    } catch (err) {
      console.error('Save asset error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAsset = async () => {
    const { assetId } = deleteModal;
    try {
      await axios.delete(`/api/assets/${assetId}`);
      setAssets(assets.filter(a => a._id !== assetId));
      setDeleteModal({ open: false, assetId: null });
      setIsDrawerOpen(false);
      setEditingAsset(null);
    } catch (err) {
      console.error('Delete asset error:', err);
    }
  };

  const handleUnlinkAccount = async (id) => {
    try {
      await axios.delete(`/api/google/accounts/${id}`);
      setGoogleAccounts(googleAccounts.filter(acc => acc._id !== id));
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
      const res = await axios.post('/api/google/accounts/manual', { emails: emails.join(',') });
      const refreshed = await axios.get('/api/google/accounts');
      setGoogleAccounts(refreshed.data);
      setIsLinkModalOpen(false);
      setSimEmail('');
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        try {
          for (const email of emails) {
            await axios.post('/api/google/accounts/simulate', { email });
          }
          const refreshed = await axios.get('/api/google/accounts');
          setGoogleAccounts(refreshed.data);
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

  const googleServiceUrl = (service, index, email) => {
    if (service.type === 'meet') return `https://meet.google.com/?authuser=${email}`;
    if (service.type === 'drive') return `https://drive.google.com/drive/u/${index}/`;
    return `https://docs.google.com/${service.path}/u/${index}/`;
  };

  const filteredAssets = useMemo(() => {
    let list = assets.filter((a) => {
      const matchesSearch = assetMatchesSearch(a, searchTerm, { includeProjectNames: true });
      const matchesProject = projectFilter === 'all'
        || (a.projectIds || []).some((p) => String(p._id || p) === String(projectFilter));
      const matchesType = typeFilter === 'all' || getDetectedType(a) === typeFilter;
      return matchesSearch && matchesProject && matchesType;
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
  }, [assets, searchTerm, projectFilter, typeFilter, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, projectFilter, typeFilter, sortBy]);

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
    const first = projectIds[0];
    const firstColor = getWorkspaceColor(first.workspace, workspaces);
    const extra = projectIds.length - 1;
    const allNames = projectIds.map((p) => p.name).join(', ');
    return (
      <div className="flex items-center gap-1 min-w-0 w-full whitespace-nowrap overflow-hidden">
        <span
          className="inline-flex items-center gap-1 min-w-0 max-w-full pl-1.5 pr-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tight bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]"
          style={{ borderLeft: `3px solid ${firstColor}` }}
          title={allNames}
        >
          <WorkspaceDot color={firstColor} className="!w-1.5 !h-1.5" />
          <span className="truncate">{first.name}</span>
        </span>
        {extra > 0 && (
          <span className="text-[8px] font-black text-[var(--color-text-muted)] shrink-0" title={allNames}>
            +{extra}
          </span>
        )}
      </div>
    );
  };

  if (loading && assets.length === 0) return <PageSkeleton />;

  return (
    <PageContainer className="!py-4 !space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div onClick={() => setTypeFilter('all')} className={`cursor-pointer transition-all ${typeFilter === 'all' ? 'ring-2 ring-[var(--color-action-primary)] shadow-lg' : ''}`}>
          <StatCard label="Total Files" value={assets.length} icon={Database} variant="info" />
        </div>
        <div onClick={() => setTypeFilter('drive')} className={`cursor-pointer transition-all ${typeFilter === 'drive' ? 'ring-2 ring-[var(--color-action-primary)] shadow-lg' : ''}`}>
          <StatCard label="Drive" value={assetTypeCounts.drive} icon={assetStatIcon('drive')} variant="mint" />
        </div>
        <div onClick={() => setTypeFilter('sheet')} className={`cursor-pointer transition-all ${typeFilter === 'sheet' ? 'ring-2 ring-[var(--color-action-primary)] shadow-lg' : ''}`}>
          <StatCard label="Sheets" value={assetTypeCounts.sheet} icon={assetStatIcon('sheet')} variant="apricot" />
        </div>
        <div onClick={() => setTypeFilter('docs')} className={`cursor-pointer transition-all ${typeFilter === 'docs' ? 'ring-2 ring-[var(--color-action-primary)] shadow-lg' : ''}`}>
          <StatCard label="Docs" value={assetTypeCounts.docs} icon={assetStatIcon('docs')} variant="slate" />
        </div>
        <div onClick={() => setTypeFilter('zoom')} className={`cursor-pointer transition-all ${typeFilter === 'zoom' ? 'ring-2 ring-[var(--color-action-primary)] shadow-lg' : ''}`}>
          <StatCard label="Zoom" value={assetTypeCounts.zoom} icon={assetStatIcon('zoom')} variant="info" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-9 space-y-6 min-w-0">
           <Card className="overflow-visible">
              <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">
                    <span className="font-black text-[var(--color-text-primary)] tabular-nums">{filteredAssets.length}</span>
                    {' '}{filteredAssets.length === 1 ? 'file' : 'files'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:flex-1 lg:justify-end">
                    <SearchInput
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Filter assets..."
                      className="w-full sm:!w-44 lg:!w-48"
                    />
                    <NexusDropdown
                      options={[{ value: 'all', label: 'All Projects' }, ...projects.map((p) => ({ value: p._id, label: p.name }))]}
                      value={projectFilter}
                      onChange={setProjectFilter}
                      placeholder="Project"
                      className="flex-1 min-w-[120px] sm:flex-none sm:!w-40"
                    />
                    <NexusDropdown
                      options={ASSET_TYPE_FILTER_OPTIONS}
                      value={typeFilter}
                      onChange={setTypeFilter}
                      placeholder="File type"
                      className="flex-1 min-w-[120px] sm:flex-none sm:!w-36"
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
                      className="flex-1 min-w-[100px] sm:flex-none sm:!w-32"
                    />
                    <Button
                      size="sm"
                      className="w-full sm:w-auto shrink-0"
                      onClick={() => { setEditingAsset(null); setNewAsset(EMPTY_ASSET_FORM); setIsDrawerOpen(true); }}
                    >
                      <Plus size={14} /> Add Link
                    </Button>
                  </div>
                </div>
              </div>
              <div className="min-w-0 pr-1 sm:pr-2">
                 <table className="w-full max-w-full text-left table-fixed">
                    <colgroup>
                      <col />
                      <col className="w-[80px] sm:w-[84px]" />
                      <col className="w-[17%] sm:w-[18%]" />
                      <col className="w-[12%] sm:w-[13%] hidden sm:table-column" />
                      <col className="w-[76px] sm:w-20" />
                    </colgroup>
                    <thead className="bg-[var(--color-bg-workspace)]/50 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] border-b border-[var(--color-bg-border)]">
                       <tr>
                          <th className="px-2 sm:px-3 py-2">File Name</th>
                          <th className="px-2 sm:px-3 py-2">Date</th>
                          <th className="px-2 sm:px-3 py-2">Projects</th>
                          <th className="px-2 sm:px-3 py-2 hidden sm:table-cell">Added By</th>
                          <th className="px-2 py-2 text-center whitespace-nowrap">Edit</th>
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
                             
                              <td className="px-2 sm:px-3 py-2 max-w-0 whitespace-nowrap">
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
                              <td className="px-2 sm:px-3 py-2 max-w-0 whitespace-nowrap">
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
                                   <div className="flex items-center gap-1.5 min-w-0">
                                      <div className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                                         <span className="text-[8px] font-black uppercase text-blue-500">{asset.createdBy.name ? asset.createdBy.name.substring(0, 2) : '??'}</span>
                                      </div>
                                      <span className="text-[10px] font-bold text-[var(--color-text-secondary)] truncate" title={asset.createdBy.name || 'Unknown'}>{asset.createdBy.name || 'Unknown'}</span>
                                   </div>
                                 ) : (
                                   <span className="text-[9px] italic opacity-30">N/A</span>
                                 )}
                              </td>
                              <td className="px-2 py-2 text-center align-middle whitespace-nowrap">
                                 <Button
                                   type="button"
                                   size="xs"
                                   variant="secondary"
                                   title="Edit asset"
                                   className="gap-1 shrink-0 mx-auto !px-2"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     setEditingAsset(asset);
                                     setNewAsset({
                                       projectIds: (asset.projectIds || []).map((p) => p._id || p),
                                       name: asset.name,
                                       link: asset.link,
                                       type: asset.type || 'other',
                                       notes: asset.notes || '',
                                     });
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
           </Card>
        </div>

        <aside className="lg:col-span-3 space-y-6">
           {/* Google Workspace Connection Panel */}
           <Card className="p-4 space-y-4">
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
                   <div key={acc._id} className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-2xl space-y-3 relative group">
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
                              className="flex flex-col items-center justify-center p-1.5 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/40 hover:bg-[var(--color-bg-surface)] hover:border-[var(--color-action-primary)]/30 transition-all relative group" 
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
           </Card>

           <Card className="p-4 bg-slate-50 dark:bg-slate-900 text-[var(--color-text-primary)] dark:text-white border-[var(--color-bg-border)] dark:border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 blur-3xl rounded-full" />
              <div className="relative z-10 space-y-3">
                 <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Storage Security</h4>
                    <Shield size={14} className="text-emerald-500" />
                 </div>
                 <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-[10px] font-bold italic text-slate-300">All registered assets are saved as secure external references.</p>
                 </div>
              </div>
           </Card>
        </aside>
      </div>

      <ModalShell isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} size="lg">
        <ModalHeader title={editingAsset ? 'Edit Asset Details' : 'Add Link Asset'} onClose={() => setIsDrawerOpen(false)} />
        <ModalBody>
          <form onSubmit={handleAddAsset} className="space-y-6">
            <div className="space-y-4">
              <Input label="Asset Title / Name" value={newAsset.name} onChange={e => setNewAsset({ ...newAsset, name: e.target.value })} placeholder="E.g., Production API Key / File Name" icon={Database} required />
              <Input label="Asset URL Link" value={newAsset.link} onChange={e => setNewAsset({ ...newAsset, link: e.target.value })} placeholder="https://..." icon={Link2} required />

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
                  className="w-full min-h-[88px] px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-action-primary)]/50 resize-y"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Button type="submit" className="w-full" disabled={submitting || !newAsset.name || !newAsset.link}>
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : editingAsset ? 'Save Changes' : <><Plus size={14} /> Add Asset</>}
              </Button>
              {editingAsset && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full !text-rose-500 hover:!bg-rose-500/10 border border-rose-500/10"
                  onClick={() => setDeleteModal({ open: true, assetId: editingAsset._id })}
                >
                  Delete Asset
                </Button>
              )}
            </div>
          </form>
        </ModalBody>
      </ModalShell>

      <ModalShell isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} size="lg">
        <ModalHeader title="Link Google Account" onClose={() => setIsLinkModalOpen(false)} icon={Cloud} iconStyle={{ color: '#3b82f6' }} />
        <ModalBody className="space-y-4">
          <p className="text-[10px] text-[var(--color-text-muted)] -mt-2">Link Google accounts to access Drive, Sheets, Docs, and Meet resources.</p>

          <button
            type="button"
            onClick={handleOAuthConnect}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
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
              className="w-full min-h-[96px] bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-4 py-2.5 text-xs font-bold outline-none text-[var(--color-text-primary)] resize-y"
              required
            />
            <button
              type="submit"
              disabled={linking || !simEmail}
              className="w-full py-2.5 bg-[var(--color-action-primary)] hover:opacity-90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
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
    </PageContainer>
  );
};

export default AssetsPage;


// Performance Optimization: useCallback(eventHandler) memoization guard
