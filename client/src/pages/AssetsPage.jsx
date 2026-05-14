import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2,
  ExternalLink,
  Plus,
  Trash2,
  Search,
  Database,
  X,
  Shield,
  Briefcase,
  Pencil,
  Check,
  XCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { NexusModal, NexusLoader, NexusDropdown, PageHeader, PageContainer, Card } from '../components/ui';
import { format } from 'date-fns';

const AssetsPage = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [driveFiles, setDriveFiles] = useState([]);


  // Create Asset Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAsset, setNewAsset] = useState({ projectId: '', name: '', link: '' });
  const [submitting, setSubmitting] = useState(false);

  // Edit state
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
    e.preventDefault();
    if (!newAsset.name) return;

    setSubmitting(true);
    try {
      const res = await axios.post('/api/assets', {
        projectId: newAsset.projectId || null,
        name: newAsset.name,
        link: newAsset.link.trim()
      });
      setAssets([res.data, ...assets]);
      setShowAddModal(false);
      setNewAsset({ projectId: '', name: '', link: '' });
    } catch (err) {
      console.error('Add asset error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (asset) => {
    setEditingId(asset._id);
    setEditData({
      name: asset.name,
      link: asset.link || '',
      projectId: asset.projectId?._id || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ name: '', link: '', projectId: '' });
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

  const canEdit = (asset) => user.role === 'admin' || user._id === asset.createdBy?._id;

  const filteredAssets = assets.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.projectId?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const AssetSkeleton = () => (
    <div className="space-y-8 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="h-10 w-32 bg-slate-200 rounded-xl" />
      </div>
      <div className="h-48 bg-slate-100 rounded-[2rem]" />
      <div className="h-[500px] bg-slate-100 rounded-[2.5rem]" />
    </div>
  );

  if (loading) return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-8 pb-32">
      <AssetSkeleton />
    </div>
  );


  return (
    <PageContainer>
      <PageHeader
        icon={Database}
        title="Assets"
        subtitle="Manage assets & important links."
        actions={
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={14} />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none w-64 focus:ring-2 focus:ring-[var(--color-action-primary)]/20 transition-all shadow-inner"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--color-action-primary)] text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[var(--color-action-hover)] transition-all shadow-lg shadow-blue-500/20"
            >
              <Plus size={14} strokeWidth={3} /> Add Asset
            </button>
          </div>
        }
      />

      {/* Google Drive Folders Section */}
      {driveFiles.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.3em] ml-2">Synced Drive Folders</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {driveFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder').map(folder => (
              <a
                key={folder.id}
                href={folder.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl flex items-center gap-4 hover:border-blue-500 transition-all group"
              >
                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M7.71 3.502L1.15 15l3.446 6.004L11.157 9.502h-3.447zM9.73 15l3.447 6.004h13.116l-3.447-6.004H9.73zM12.29 3.502L15.737 9.502h6.895L19.185 3.502H12.29z" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-[var(--color-text-primary)] truncate uppercase tracking-tight">{folder.name}</p>
                  <p className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Google Drive Folder</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}


      {/* Table */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.4 } }}
      >
        <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--color-bg-workspace)]/50 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] border-b border-[var(--color-bg-border)]">
              <tr>
                <th className="px-10 py-6">Project</th>
                <th className="px-10 py-6">Asset Name</th>
                <th className="px-10 py-6">Link</th>
                <th className="px-10 py-6">Created By</th>
                <th className="px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-border)]">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-10 py-32 text-center">
                    <div className="opacity-20 flex flex-col items-center gap-4">
                      <Shield size={48} />
                      <p className="text-xs font-black uppercase tracking-widest">No assets found.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredAssets.map((asset) => (
                <tr key={asset._id} className="hover:bg-blue-500/5 transition-all group">
                  {/* Project */}
                  <td className="px-10 py-8">
                    {editingId === asset._id ? (
                      <NexusDropdown
                        options={[{ value: '', label: 'No Project' }, ...projects.map(p => ({ value: p._id, label: p.name }))]}
                        value={editData.projectId}
                        onChange={(val) => setEditData({ ...editData, projectId: val })}
                        variant="compact"
                      />
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--color-bg-workspace)] rounded-lg text-blue-500 border border-[var(--color-bg-border)] group-hover:border-blue-500/30 transition-all">
                          <Briefcase size={14} />
                        </div>
                        <span className="text-xs font-black text-[var(--color-text-primary)] uppercase tracking-tight">{asset.projectId?.name || 'No Project'}</span>
                      </div>
                    )}
                  </td>

                  {/* Name */}
                  <td className="px-10 py-8">
                    {editingId === asset._id ? (
                      <input
                        type="text"
                        value={editData.name}
                        onChange={e => setEditData({ ...editData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-blue-500/30 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    ) : (
                      <div className="space-y-0.5">
                        <p className="text-sm font-black text-[var(--color-text-primary)] group-hover:text-blue-600 transition-colors">{asset.name}</p>
                        <p className="text-[9px] font-bold text-[var(--color-text-muted)]">{format(new Date(asset.createdAt), 'MMM d, yyyy')}</p>
                      </div>
                    )}
                  </td>

                  {/* Link */}
                  <td className="px-10 py-8">
                    {editingId === asset._id ? (
                      <input
                        type="text"
                        value={editData.link}
                        onChange={e => setEditData({ ...editData, link: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-blue-500/30 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    ) : asset.link ? (
                      <div className="flex flex-col gap-2">
                        <a
                          href={asset.link.startsWith('http') ? asset.link : `https://${asset.link}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-[9px] font-black text-blue-500 hover:bg-blue-500 hover:text-white transition-all uppercase tracking-widest shadow-sm max-w-[200px] truncate"
                        >
                          {asset.link.includes('drive.google.com') ? (
                            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M7.71 3.502L1.15 15l3.446 6.004L11.157 9.502h-3.447zM9.73 15l3.447 6.004h13.116l-3.447-6.004H9.73zM12.29 3.502L15.737 9.502h6.895L19.185 3.502H12.29z" /></svg>
                          ) : <ExternalLink size={10} />}
                          Open {asset.link.includes('drive.google.com') ? 'Drive' : 'Link'}
                        </a>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[var(--color-text-muted)] italic">No link</span>
                    )}

                  </td>

                  {/* Created By */}
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center font-black text-[8px] text-blue-400">
                        {asset.createdBy?.name?.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[10px] font-black text-[var(--color-text-secondary)] uppercase">{asset.createdBy?.name}</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-10 py-8 text-right">
                    {canEdit(asset) && (
                      <div className="flex items-center justify-end gap-2">
                        {editingId === asset._id ? (
                          <>
                            <button
                              onClick={() => saveEdit(asset._id)}
                              className="p-2.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg"
                              title="Save"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-2.5 bg-gray-500/10 text-gray-400 border border-gray-500/20 rounded-xl hover:bg-gray-500 hover:text-white transition-all shadow-lg"
                              title="Cancel"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(asset)}
                              className="p-2.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-lg"
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                            {user.role === 'admin' && (
                              <button
                                onClick={() => setDeleteModal({ open: true, assetId: asset._id })}
                                className="p-2.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-lg"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </Card>
      </motion.section>

      {/* Add Asset Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[var(--color-bg-surface)] w-full max-w-xl rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden"
            >
              <header className="p-8 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 shadow-sm"><Database size={20} strokeWidth={2.5} /></div>
                  <div>
                    <h2 className="text-xl font-black text-[var(--color-text-primary)] uppercase tracking-tight">Add New Asset</h2>
                    <p className="text-[10px] text-[var(--color-text-muted)] font-black uppercase tracking-widest">Save a link or resource.</p>
                  </div>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2.5 hover:bg-[var(--color-bg-border)] rounded-xl transition-all"><X size={18} /></button>
              </header>

              <form onSubmit={handleAddAsset} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <NexusDropdown
                    options={[{ value: '', label: 'No Project' }, ...projects.map(p => ({ value: p._id, label: p.name }))]}
                    value={newAsset.projectId}
                    onChange={(val) => setNewAsset({ ...newAsset, projectId: val })}
                    label="Project (Optional)"
                    searchable={projects.length > 5}
                    placeholder="No Project"
                  />
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Resource Name</label>
                    <input
                      type="text"
                      placeholder="E.g., Production Keys..."
                      value={newAsset.name}
                      onChange={e => setNewAsset({ ...newAsset, name: e.target.value })}
                      required
                      className="w-full px-4 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Link</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                      <Link2 size={14} />
                    </div>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={newAsset.link}
                      onChange={e => setNewAsset({ ...newAsset, link: e.target.value })}
                      className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50 active:scale-[0.98] mt-4"
                >
                  {submitting ? 'Saving...' : 'Save Asset'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <NexusModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, assetId: null })}
        title="Delete Asset"
        message="Are you sure you want to permanently delete this asset? This cannot be undone."
        type="danger"
        isConfirm
        confirmLabel="Delete Asset"
        onConfirm={handleDeleteAsset}
      />
    </PageContainer>
  );
};

export default AssetsPage;
