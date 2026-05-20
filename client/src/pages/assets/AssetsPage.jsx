import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, ExternalLink, Plus, Trash2, Search, Database,
  Shield, RefreshCw, Cloud, Globe, FileText, HardDrive, Video, X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  NexusModal, NexusDropdown, PageHeader, 
  PageContainer, Card, Button, Input, StatCard, Badge, 
  InputFormDrawer, PageSkeleton
} from '../../components/ui';
import { format } from 'date-fns';

const AssetsPage = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [driveFiles, setDriveFiles] = useState([]);

  // Google account link states
  const [googleAccounts, setGoogleAccounts] = useState([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [simEmail, setSimEmail] = useState('');
  const [linking, setLinking] = useState(false);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({ projectIds: [], name: '', link: '', type: 'other' });
  const [submitting, setSubmitting] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);

  const [deleteModal, setDeleteModal] = useState({ open: false, assetId: null });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assetsRes, projectsRes, driveRes, googleRes] = await Promise.all([
        axios.get('/api/assets'),
        axios.get('/api/projects'),
        axios.get('/api/google/drive/files').catch(() => ({ data: [] })),
        axios.get('/api/google/accounts').catch(() => ({ data: [] }))
      ]);
      setAssets(assetsRes.data);
      setProjects(projectsRes.data);
      setDriveFiles(driveRes.data);
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
          type: newAsset.type || 'other'
        });
        setAssets(assets.map(a => a._id === editingAsset._id ? res.data : a));
        setIsDrawerOpen(false);
        setEditingAsset(null);
        setNewAsset({ projectIds: [], name: '', link: '', type: 'other' });
      } else {
        const res = await axios.post('/api/assets', {
          projectIds: newAsset.projectIds,
          name: newAsset.name,
          link: newAsset.link.trim(),
          type: newAsset.type || 'other'
        });
        setAssets([res.data, ...assets]);
        setIsDrawerOpen(false);
        setNewAsset({ projectIds: [], name: '', link: '', type: 'other' });
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
      // Refresh drive files as well
      const driveRes = await axios.get('/api/google/drive/files').catch(() => ({ data: [] }));
      setDriveFiles(driveRes.data);
    } catch (err) {
      console.error('Failed to unlink account:', err);
    }
  };

  const handleSimulateConnect = async (e) => {
    if (e) e.preventDefault();
    if (!simEmail || !simEmail.includes('@')) return;
    setLinking(true);
    try {
      const res = await axios.post('/api/google/accounts/simulate', { email: simEmail });
      setGoogleAccounts([...googleAccounts, res.data]);
      setIsLinkModalOpen(false);
      setSimEmail('');
      // Refresh drive files
      const driveRes = await axios.get('/api/google/drive/files').catch(() => ({ data: [] }));
      setDriveFiles(driveRes.data);
    } catch (err) {
      console.error('Failed to simulate connect:', err);
    } finally {
      setLinking(false);
    }
  };

  const handleOAuthConnect = () => {
    window.location.href = `/api/auth/google?state=link_${user?._id}`;
  };

  const getAssetTypeConfig = (type, link) => {
    let detectedType = type;
    const url = (link || '').toLowerCase();
    if (!type || type === 'other') {
      if (url.includes('docs.google.com/spreadsheets')) detectedType = 'sheet';
      else if (url.includes('docs.google.com/document')) detectedType = 'docs';
      else if (url.includes('docs.google.com/presentation')) detectedType = 'presentation';
      else if (url.includes('drive.google.com')) detectedType = 'drive';
      else if (url.includes('meet.google.com')) detectedType = 'meet';
    }

    switch (detectedType) {
      case 'drive':
        return {
          icon: Cloud,
          label: 'Google Drive',
          colorClass: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
        };
      case 'sheet':
        return {
          icon: Database,
          label: 'Google Sheet',
          colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
        };
      case 'docs':
        return {
          icon: FileText,
          label: 'Google Doc',
          colorClass: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20'
        };
      case 'presentation':
        return {
          icon: Globe,
          label: 'Presentation',
          colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
        };
      case 'meet':
        return {
          icon: Video,
          label: 'Google Meet',
          colorClass: 'text-rose-500 bg-rose-500/10 border-rose-500/20'
        };
      default:
        return {
          icon: Link2,
          label: 'Link',
          colorClass: 'text-[var(--color-text-secondary)] bg-[var(--color-bg-workspace)] border-[var(--color-bg-border)]'
        };
    }
  };

  const filteredAssets = useMemo(() => assets.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.projectIds || []).some(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
  ), [assets, searchTerm]);

  const driveFolders = useMemo(() => 
    driveFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder'),
  [driveFiles]);

  const sheetsCount = useMemo(() => {
    return assets.filter(a => {
      let detectedType = a.type;
      const url = (a.link || '').toLowerCase();
      if (!a.type || a.type === 'other') {
        if (url.includes('docs.google.com/spreadsheets')) detectedType = 'sheet';
      }
      return detectedType === 'sheet';
    }).length;
  }, [assets]);

  const docsCount = useMemo(() => {
    return assets.filter(a => {
      let detectedType = a.type;
      const url = (a.link || '').toLowerCase();
      if (!a.type || a.type === 'other') {
        if (url.includes('docs.google.com/document')) detectedType = 'docs';
      }
      return detectedType === 'docs';
    }).length;
  }, [assets]);

  if (loading && assets.length === 0) return <PageSkeleton />;

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Files & Assets"
        subtitle="Store and manage project files, links, and documents."
        actions={
          <div className="flex items-center gap-2">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={12} />
                <Input 
                   value={searchTerm} 
                   onChange={e => setSearchTerm(e.target.value)} 
                   placeholder="Filter assets..." 
                   className="!pl-9 !py-1.5 !w-48 !text-[10px]" 
                />
             </div>
             <Button size="sm" onClick={() => { setEditingAsset(null); setNewAsset({ projectIds: [], name: '', link: '', type: 'other' }); setIsDrawerOpen(true); }}><Plus size={14} /> Add Link</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Files" value={assets.length} icon={Database} variant="info" />
        <StatCard label="Google Drive Folders" value={driveFolders.length} icon={Cloud} variant="mint" />
        <StatCard label="Google Sheets" value={sheetsCount} icon={Database} variant="apricot" />
        <StatCard label="Google Docs" value={docsCount} icon={FileText} variant="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
           <Card className="overflow-hidden">
              <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
                 <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <FileText size={14} className="text-blue-500" /> File Directory
                 </h3>
                 <Badge variant="slate">{filteredAssets.length} FILES</Badge>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-[var(--color-bg-workspace)]/50 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] border-b border-[var(--color-bg-border)]">
                       <tr>
                          <th className="px-4 py-2">Projects</th>
                          <th className="px-4 py-2">File Name</th>
                          <th className="px-4 py-2">Added By</th>
                          <th className="px-4 py-2">Link / URL</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-bg-border)]">
                       {filteredAssets.length === 0 ? (
                         <tr>
                            <td colSpan="4" className="py-20 text-center opacity-20">
                               <Database size={48} className="mx-auto mb-4" />
                               <p className="text-[10px] font-black uppercase tracking-widest">No files uploaded yet</p>
                            </td>
                         </tr>
                       ) : filteredAssets.map((asset) => {
                         const typeConfig = getAssetTypeConfig(asset.type, asset.link);
                         const TypeIcon = typeConfig.icon;
                         return (
                           <tr 
                             key={asset._id} 
                             onClick={() => {
                               setEditingAsset(asset);
                               setNewAsset({
                                 projectIds: (asset.projectIds || []).map(p => p._id || p),
                                 name: asset.name,
                                 link: asset.link,
                                 type: asset.type || 'other'
                               });
                               setIsDrawerOpen(true);
                             }}
                             className="group hover:bg-[var(--color-bg-secondary)]/50 transition-all cursor-pointer"
                           >
                              <td className="px-4 py-2">
                                 {asset.projectIds && asset.projectIds.length > 0 ? (
                                   <div className="flex flex-wrap gap-1">
                                     {asset.projectIds.map(p => (
                                       <Badge key={p._id} variant="info" className="text-[8px]">{p.name}</Badge>
                                     ))}
                                   </div>
                                 ) : <Badge variant="slate" className="text-[8px]">ROOT</Badge>}
                              </td>
                              <td className="px-4 py-2">
                                 <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${typeConfig.colorClass}`}>
                                       <TypeIcon size={14} />
                                    </div>
                                    <div>
                                       <p className="text-[11px] font-black text-[var(--color-text-primary)] leading-tight">{asset.name}</p>
                                       <p className="text-[8px] text-[var(--color-text-muted)] uppercase mt-0.5">{format(new Date(asset.createdAt), 'MMM dd, yyyy')}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-4 py-2">
                                 {asset.createdBy ? (
                                   <div className="flex items-center gap-2">
                                      <div className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                                         <span className="text-[8px] font-black uppercase text-blue-500">{asset.createdBy.name ? asset.createdBy.name.substring(0, 2) : '??'}</span>
                                      </div>
                                      <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">{asset.createdBy.name || 'Unknown'}</span>
                                   </div>
                                 ) : (
                                   <span className="text-[9px] italic opacity-30">N/A</span>
                                 )}
                              </td>
                              <td className="px-4 py-2">
                                 {asset.link ? (
                                   <div className="flex items-center gap-2">
                                     <a 
                                       href={asset.link.startsWith('http') ? asset.link : `https://${asset.link}`} 
                                       target="_blank" 
                                       rel="noopener noreferrer"
                                       onClick={e => e.stopPropagation()}
                                       className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-500 hover:bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20"
                                     >
                                       <ExternalLink size={12} /> Open Link
                                     </a>
                                   </div>
                                 ) : <span className="text-[9px] italic opacity-30">N/A</span>}
                              </td>
                           </tr>
                         );
                       })}
                    </tbody>
                 </table>
              </div>
           </Card>
        </div>

        <aside className="lg:col-span-4 space-y-6">
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
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { name: 'Drive', icon: Cloud, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20 hover:border-blue-500/50', url: `https://drive.google.com/drive/u/${index}/` },
                          { name: 'Sheets', icon: Database, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50', url: `https://docs.google.com/spreadsheets/u/${index}/` },
                          { name: 'Docs', icon: FileText, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20 hover:border-indigo-500/50', url: `https://docs.google.com/document/u/${index}/` },
                          { name: 'Slides', icon: Globe, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20 hover:border-amber-500/50', url: `https://docs.google.com/presentation/u/${index}/` },
                          { name: 'Meet', icon: Video, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20 hover:border-rose-500/50', url: `https://meet.google.com/?authuser=${acc.email}` }
                        ].map(service => {
                          const Icon = service.icon;
                          return (
                            <a 
                              key={service.name} 
                              href={service.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-col items-center justify-center p-2 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/40 hover:bg-[var(--color-bg-workspace)] hover:scale-105 transition-all relative group" 
                              title={`Open Google ${service.name}`}
                            >
                              <div className={`p-1.5 rounded-lg ${service.color} shrink-0 mb-1`}>
                                <Icon size={12} />
                              </div>
                              <span className="text-[7px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">{service.name}</span>
                              <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
                            </a>
                          );
                        })}
                      </div>
                   </div>
                ))}
              </div>
           </Card>

           <Card className="p-4 bg-slate-900 text-white border-white/5 relative overflow-hidden">
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

      <InputFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingAsset ? "Edit Asset Details" : "Add Link Asset"}
      >
        <div className="p-6 space-y-6">
           <form onSubmit={handleAddAsset} className="space-y-6">
              <div className="space-y-4">
                 <Input label="Asset Title / Name" value={newAsset.name} onChange={e => setNewAsset({ ...newAsset, name: e.target.value })} placeholder="E.g., Production API Key / File Name" icon={Database} required />
                 <Input label="Asset URL Link" value={newAsset.link} onChange={e => setNewAsset({ ...newAsset, link: e.target.value })} placeholder="https://..." icon={Link2} required />
                 
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Asset Type</label>
                    <NexusDropdown 
                      options={[
                        { value: 'drive', label: 'Google Drive' },
                        { value: 'sheet', label: 'Google Sheet' },
                        { value: 'docs', label: 'Google Doc' },
                        { value: 'presentation', label: 'Presentation' },
                        { value: 'meet', label: 'Google Meet' },
                        { value: 'other', label: 'Other Link' }
                      ]} 
                      value={newAsset.type} 
                      onChange={(val) => setNewAsset({ ...newAsset, type: val })} 
                      placeholder="Select Asset Type"
                    />
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Associated Projects</label>
                    <NexusDropdown 
                      isMulti
                      options={projects.map(p => ({ value: p._id, label: p.name }))} 
                      value={newAsset.projectIds || []} 
                      onChange={(val) => setNewAsset({ ...newAsset, projectIds: Array.isArray(val) ? val : [val].filter(Boolean) })} 
                      placeholder="Select Projects"
                      searchable
                    />
                 </div>
              </div>
              <div className="space-y-2">
                 <Button type="submit" className="w-full" disabled={submitting || !newAsset.name || !newAsset.link}>
                    {submitting ? <RefreshCw size={14} className="animate-spin" /> : editingAsset ? "Save Changes" : <><Plus size={14} /> Add Asset</>}
                 </Button>
                 {editingAsset && (
                    <Button 
                       type="button" 
                       variant="ghost" 
                       className="w-full !text-rose-500 hover:!bg-rose-500/10 border border-rose-500/10" 
                       onClick={() => {
                          setDeleteModal({ open: true, assetId: editingAsset._id });
                       }}
                    >
                       Delete Asset
                    </Button>
                 )}
              </div>
           </form>
        </div>
      </InputFormDrawer>

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

      <AnimatePresence>
        {isLinkModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsLinkModalOpen(false)}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] w-full max-w-sm rounded-[2rem] shadow-2xl p-6 relative"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setIsLinkModalOpen(false)} 
                className="absolute top-4 right-4 p-1.5 hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-muted)]"
              >
                <X size={16} />
              </button>
              
              <h3 className="text-sm font-black uppercase tracking-tight text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
                <Cloud className="text-blue-500" size={16} /> Link Google Account
              </h3>
              <p className="text-[10px] text-[var(--color-text-muted)] mb-4">Link Google accounts to access Drive, Sheets, Docs, and Presentation resources.</p>
              
              <button 
                onClick={handleOAuthConnect}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all mb-4 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
              >
                <Cloud size={14} /> Connect via Google OAuth
              </button>
              
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[var(--color-bg-border)]"></div>
                <span className="flex-shrink mx-3 text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Or simulate</span>
                <div className="flex-grow border-t border-[var(--color-bg-border)]"></div>
              </div>
              
              <form onSubmit={handleSimulateConnect} className="mt-3 space-y-3">
                <input 
                  type="email" 
                  value={simEmail} 
                  onChange={e => setSimEmail(e.target.value)} 
                  placeholder="Enter google email..." 
                  className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-4 py-2.5 text-xs font-bold outline-none text-[var(--color-text-primary)]"
                  required
                />
                <button 
                  type="submit" 
                  disabled={linking || !simEmail}
                  className="w-full py-2.5 bg-[var(--color-bg-border)] hover:bg-[var(--color-bg-border)]/80 text-[var(--color-text-primary)] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  {linking ? 'Linking...' : 'Connect Simulated Account'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
};

export default AssetsPage;
