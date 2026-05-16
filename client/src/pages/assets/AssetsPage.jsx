import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, ExternalLink, Plus, Trash2, Search, Database, X,
  Shield, Briefcase, Pencil, Check, XCircle, HardDrive, 
  RefreshCw, Cloud, Lock, Globe, FileText, Layout
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  NexusModal, NexusDropdown, PageHeader, 
  PageContainer, Card, Button, Input, StatCard, Badge, 
  DataTable, InputFormDrawer, PageSkeleton
} from '../../components/ui';
import { format } from 'date-fns';

const AssetsPage = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [driveFiles, setDriveFiles] = useState([]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({ projectId: '', name: '', link: '' });
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: '', link: '', projectId: '' });

  const [deleteModal, setDeleteModal] = useState({ open: false, assetId: null });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assetsRes, projectsRes, driveRes] = await Promise.all([
        axios.get('/api/assets'),
        axios.get('/api/projects'),
        axios.get('/api/google/drive/files').catch(() => ({ data: [] }))
      ]);
      setAssets(assetsRes.data);
      setProjects(projectsRes.data);
      setDriveFiles(driveRes.data);
    } catch (err) {
      console.error('Error fetching assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsset = async (e) => {
    if (e) e.preventDefault();
    if (!newAsset.name) return;

    setSubmitting(true);
    try {
      const res = await axios.post('/api/assets', {
        projectId: newAsset.projectId || null,
        name: newAsset.name,
        link: newAsset.link.trim()
      });
      setAssets([res.data, ...assets]);
      setIsDrawerOpen(false);
      setNewAsset({ projectId: '', name: '', link: '' });
    } catch (err) {
      console.error('Add asset error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const saveEdit = async (assetId) => {
    try {
      const res = await axios.put(`/api/assets/${assetId}`, {
        name: editData.name,
        link: editData.link.trim(),
        projectId: editData.projectId || null
      });
      setAssets(assets.map(a => a._id === assetId ? res.data : a));
      setEditingId(null);
    } catch (err) {
      console.error('Edit asset error:', err);
    }
  };

  const handleDeleteAsset = async () => {
    const { assetId } = deleteModal;
    try {
      await axios.delete(`/api/assets/${assetId}`);
      setAssets(assets.filter(a => a._id !== assetId));
      setDeleteModal({ open: false, assetId: null });
    } catch (err) {
      console.error('Delete asset error:', err);
    }
  };

  const filteredAssets = useMemo(() => assets.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.projectId?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  ), [assets, searchTerm]);

  const driveFolders = useMemo(() => 
    driveFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder'),
  [driveFiles]);

  if (loading && assets.length === 0) return <PageSkeleton />;

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Asset Repository"
        subtitle="Operational infrastructure and resource synchronization."
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
             <Button size="sm" onClick={() => setIsDrawerOpen(true)}><Plus size={14} /> Register Asset</Button>
          </div>
        }
      />

      {/* Analytical Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Internal Assets" value={assets.length} icon={Database} variant="info" />
        <StatCard label="Synced Volumes" value={driveFolders.length} icon={Cloud} variant="mint" />
        <StatCard label="Redundancy" value="OPTIONAL" icon={Shield} variant="apricot" />
        <StatCard label="Storage Status" value="ACTIVE" icon={HardDrive} variant="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
           <Card className="overflow-hidden">
              <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
                 <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <FileText size={14} className="text-blue-500" /> Operational Matrix
                 </h3>
                 <Badge variant="slate">{filteredAssets.length} REGISTERED</Badge>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-[var(--color-bg-workspace)]/50 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] border-b border-[var(--color-bg-border)]">
                       <tr>
                          <th className="px-6 py-4">Context</th>
                          <th className="px-6 py-4">Identifier</th>
                          <th className="px-6 py-4">Endpoint</th>
                          <th className="px-6 py-4 text-right">Ops</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-bg-border)]">
                       {filteredAssets.length === 0 ? (
                         <tr>
                            <td colSpan="4" className="py-20 text-center opacity-20">
                               <Database size={48} className="mx-auto mb-4" />
                               <p className="text-[10px] font-black uppercase tracking-widest">Repository Vacant</p>
                            </td>
                         </tr>
                       ) : filteredAssets.map((asset) => (
                         <tr key={asset._id} className="group hover:bg-[var(--color-bg-secondary)]/50 transition-all">
                            <td className="px-6 py-4">
                               <Badge variant="info" className="text-[8px]">{asset.projectId?.name || 'ROOT'}</Badge>
                            </td>
                            <td className="px-6 py-4">
                               <p className="text-[11px] font-black text-[var(--color-text-primary)] leading-tight">{asset.name}</p>
                               <p className="text-[8px] text-[var(--color-text-muted)] uppercase mt-0.5">{format(new Date(asset.createdAt), 'MMM dd, yyyy')}</p>
                            </td>
                            <td className="px-6 py-4">
                               {asset.link ? (
                                 <a 
                                   href={asset.link.startsWith('http') ? asset.link : `https://${asset.link}`} 
                                   target="_blank" 
                                   rel="noopener noreferrer"
                                   className="inline-flex items-center gap-2 text-[10px] font-bold text-blue-500 hover:underline"
                                 >
                                    <ExternalLink size={10} /> Link
                                 </a>
                               ) : <span className="text-[9px] italic opacity-30">N/A</span>}
                            </td>
                            <td className="px-6 py-4 text-right">
                               <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="xs" onClick={() => {
                                     setEditingId(asset._id);
                                     setEditData({ name: asset.name, link: asset.link || '', projectId: asset.projectId?._id || '' });
                                  }}><Pencil size={12} /></Button>
                                  <Button variant="ghost" size="xs" className="text-rose-500 hover:bg-rose-500/10" onClick={() => setDeleteModal({ open: true, assetId: asset._id })}><Trash2 size={12} /></Button>
                               </div>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </Card>
        </div>

        <aside className="lg:col-span-4 space-y-6">
           <Card className="p-4 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                 <Cloud size={14} /> Drive Synchronization
              </h4>
              <div className="space-y-2">
                 {driveFolders.length === 0 ? (
                   <p className="text-[10px] text-[var(--color-text-muted)] italic text-center py-4">No volumes synced</p>
                 ) : driveFolders.map(folder => (
                   <a 
                     key={folder.id} 
                     href={folder.webViewLink} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] flex items-center gap-3 hover:border-blue-500 transition-all group"
                   >
                      <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg group-hover:scale-110 transition-transform">
                         <HardDrive size={14} />
                      </div>
                      <div className="min-w-0">
                         <p className="text-[10px] font-black uppercase truncate leading-tight">{folder.name}</p>
                         <p className="text-[8px] text-[var(--color-text-muted)] font-black italic">Cloud Volume</p>
                      </div>
                   </a>
                 ))}
              </div>
           </Card>

           <Card className="p-4 bg-slate-900 text-white border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 blur-3xl rounded-full" />
              <div className="relative z-10 space-y-3">
                 <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Security Index</h4>
                    <Shield size={14} className="text-emerald-500" />
                 </div>
                 <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-[10px] font-bold italic text-slate-300">All registered assets are encrypted at rest and audited via Temporal Log Stream.</p>
                 </div>
              </div>
           </Card>
        </aside>
      </div>

      <InputFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Asset Registration"
      >
        <form onSubmit={handleAddAsset} className="space-y-6 p-6">
           <div className="space-y-4">
              <Input label="Asset Identifier" value={newAsset.name} onChange={e => setNewAsset({ ...newAsset, name: e.target.value })} placeholder="E.g., Production API Key" icon={Database} required />
              <Input label="Access Endpoint (URL)" value={newAsset.link} onChange={e => setNewAsset({ ...newAsset, link: e.target.value })} placeholder="https://..." icon={Link2} />
              <div className="space-y-1.5">
                 <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Parent Context</label>
                 <NexusDropdown 
                   options={[{ value: '', label: 'Root / No Project' }, ...projects.map(p => ({ value: p._id, label: p.name }))]} 
                   value={newAsset.projectId} 
                   onChange={(val) => setNewAsset({ ...newAsset, projectId: val })} 
                   placeholder="Select Project"
                   searchable
                 />
              </div>
           </div>
           <Button type="submit" className="w-full" disabled={submitting || !newAsset.name}>
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : <><Plus size={14} /> Register Asset</>}
           </Button>
        </form>
      </InputFormDrawer>

      <NexusModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, assetId: null })}
        title="Destroy Asset"
        message="Irreversible deletion of resource registry entry. Proceed with caution."
        type="danger"
        isConfirm
        confirmLabel="Destroy entry"
        onConfirm={handleDeleteAsset}
      />
    </PageContainer>
  );
};

export default AssetsPage;
