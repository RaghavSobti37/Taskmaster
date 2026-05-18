import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, ExternalLink, Plus, Trash2, Search, Database, X,
  Shield, Briefcase, Pencil, Check, XCircle, HardDrive, 
  RefreshCw, Cloud, Lock, Globe, FileText, Layout, UploadCloud, Download, Eye
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  NexusModal, NexusDropdown, PageHeader, 
  PageContainer, Card, Button, Input, StatCard, Badge, 
  DataTable, InputFormDrawer, PageSkeleton
} from '../../components/ui';
import { format } from 'date-fns';
import { UploadDropzone } from '../../utils/uploadthing';

const AssetsPage = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [driveFiles, setDriveFiles] = useState([]);
  const [previewAsset, setPreviewAsset] = useState(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({ projectId: '', name: '', link: '' });
  const [submitting, setSubmitting] = useState(false);
  const [uploadMode, setUploadMode] = useState(false);

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
             <Button size="sm" onClick={() => { setIsDrawerOpen(true); setUploadMode(true); }}><Plus size={14} /> Add File</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Files" value={assets.length} icon={Database} variant="info" />
        <StatCard label="Google Drive Folders" value={driveFolders.length} icon={Cloud} variant="mint" />
        <StatCard label="Cloud Storage" value="CONNECTED" icon={UploadCloud} variant="apricot" />
        <StatCard label="Status" value="ACTIVE" icon={HardDrive} variant="slate" />
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
                          <th className="px-6 py-4">Project</th>
                          <th className="px-6 py-4">File Name</th>
                          <th className="px-6 py-4">Link / URL</th>
                          <th className="px-6 py-4 text-right">Actions</th>
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
                                 <div className="flex items-center gap-2">
                                   <Button 
                                     size="xs" 
                                     variant="ghost" 
                                     className="text-blue-400 hover:bg-blue-500/10 flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-blue-500/20"
                                     onClick={() => setPreviewAsset(asset)}
                                   >
                                     <Eye size={12} /> Preview
                                   </Button>
                                   <a 
                                     href={asset.link.startsWith('http') ? asset.link : `https://${asset.link}`} 
                                     download={asset.name}
                                     target="_blank" 
                                     rel="noopener noreferrer"
                                     className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20"
                                   >
                                     <Download size={12} /> Download
                                   </a>
                                 </div>
                               ) : <span className="text-[9px] italic opacity-30">N/A</span>}
                            </td>
                            <td className="px-6 py-4 text-right">
                               <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                 <Cloud size={14} /> Google Drive Sync
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
                         <p className="text-[8px] text-[var(--color-text-muted)] font-black italic">Cloud Folder</p>
                      </div>
                   </a>
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
                    <p className="text-[10px] font-bold italic text-slate-300">All registered assets are encrypted at rest and hosted securely via UploadThing cloud infrastructure.</p>
                 </div>
              </div>
           </Card>
        </aside>
      </div>

      <InputFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Add File or Link"
      >
        <div className="p-6 space-y-6">
           <div className="flex items-center gap-2 bg-[var(--color-bg-secondary)] p-1 rounded-lg">
              <Button size="xs" variant={uploadMode ? 'primary' : 'ghost'} className="flex-1" onClick={() => setUploadMode(true)}>
                <UploadCloud size={12} className="mr-1.5" /> Upload File (UploadThing)
              </Button>
              <Button size="xs" variant={!uploadMode ? 'primary' : 'ghost'} className="flex-1" onClick={() => setUploadMode(false)}>
                <Link2 size={12} className="mr-1.5" /> Direct URL Link
              </Button>
           </div>

           {uploadMode ? (
             <div className="border border-dashed border-[var(--color-bg-border)] rounded-xl p-8 text-center bg-[var(--color-bg-secondary)]/30 space-y-4">
                <UploadDropzone
                  endpoint="documentUploader"
                  onClientUploadComplete={(res) => {
                    if (res && res.length > 0) {
                      setNewAsset({ ...newAsset, link: res[0].url, name: res[0].name || 'Uploaded File' });
                      setUploadMode(false);
                    }
                  }}
                  onUploadError={(error) => {
                    console.error("Upload error:", error);
                  }}
                />
                <p className="text-[10px] text-[var(--color-text-muted)] italic">Drag & drop files or click to upload securely via UploadThing.</p>
             </div>
           ) : null}

           <form onSubmit={handleAddAsset} className="space-y-6">
              <div className="space-y-4">
                 <Input label="File Name / Title" value={newAsset.name} onChange={e => setNewAsset({ ...newAsset, name: e.target.value })} placeholder="E.g., Production API Key / File Name" icon={Database} required />
                 <Input label="File Link (URL)" value={newAsset.link} onChange={e => setNewAsset({ ...newAsset, link: e.target.value })} placeholder="https://..." icon={Link2} />
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Project</label>
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
                 {submitting ? <RefreshCw size={14} className="animate-spin" /> : <><Plus size={14} /> Add File</>}
              </Button>
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

      {previewAsset && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setPreviewAsset(null)}>
          <div className="bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-blue-500" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight">{previewAsset.name}</h3>
                  <p className="text-[10px] text-[var(--color-text-muted)] font-mono">{previewAsset.link}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={previewAsset.link.startsWith('http') ? previewAsset.link : `https://${previewAsset.link}`}
                  download={previewAsset.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  <Download size={14} /> Direct Download
                </a>
                <Button variant="ghost" size="sm" onClick={() => setPreviewAsset(null)}>
                  <X size={18} />
                </Button>
              </div>
            </div>
            <div className="p-6 flex-1 flex items-center justify-center overflow-auto bg-slate-950/60 min-h-[400px]">
              {previewAsset.link.match(/\.(jpeg|jpg|gif|png|webp)$/i) || previewAsset.link.includes('utfs.io/f/') ? (
                <img src={previewAsset.link.startsWith('http') ? previewAsset.link : `https://${previewAsset.link}`} alt={previewAsset.name} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl border border-white/10" />
              ) : previewAsset.link.match(/\.(pdf)$/i) ? (
                <iframe src={previewAsset.link.startsWith('http') ? previewAsset.link : `https://${previewAsset.link}`} title={previewAsset.name} className="w-full h-[70vh] rounded-lg border border-white/10" />
              ) : (
                <div className="text-center space-y-3">
                  <FileText size={64} className="mx-auto text-blue-500 animate-pulse" />
                  <p className="text-xs font-mono text-[var(--color-text-muted)]">Document preview unavailable in browser frame.</p>
                  <a 
                    href={previewAsset.link.startsWith('http') ? previewAsset.link : `https://${previewAsset.link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-xs font-bold rounded-xl hover:bg-blue-600 transition-colors"
                  >
                    <ExternalLink size={14} /> Open Document in New Tab
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default AssetsPage;
