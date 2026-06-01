import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  Plus, 
  Trash2, 
  X
} from 'lucide-react';
import { Card, Badge, NexusDropdown, SearchInput, Button } from '../ui';
import {
  AssetTypeIconBadge,
  ASSET_TYPE_FORM_OPTIONS,
} from '../assets/assetTypeIcons';
import { format } from 'date-fns';
import { assetMatchesSearch } from '../../utils/assetSearch';

const openAssetLink = (link) => {
  const trimmed = link?.trim();
  if (!trimmed) return;
  const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

const ProjectAssets = ({ projectId }) => {
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAsset, setNewAsset] = useState({ name: '', link: '', type: 'other', projectIds: [projectId], notes: '' });

  useEffect(() => {
    fetchAssets();
    fetchProjects();
  }, [projectId]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/assets?projectId=${projectId}`);
      setAssets(res.data);
    } catch (err) {
      console.error('Error fetching project assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await axios.get('/api/projects');
      setProjects(res.data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const handleAddAsset = async (e) => {
    e.preventDefault();
    if (!newAsset.name || !newAsset.link) return;
    try {
      const res = await axios.post('/api/assets', {
        projectIds: newAsset.projectIds,
        name: newAsset.name,
        link: newAsset.link.trim(),
        type: newAsset.type || 'other',
        notes: newAsset.notes?.trim() || ''
      });
      // Only append to screen list if it matches the current project
      if (newAsset.projectIds.includes(projectId)) {
        setAssets([res.data, ...assets]);
      }
      setShowAddModal(false);
      setNewAsset({ name: '', link: '', type: 'other', projectIds: [projectId], notes: '' });
    } catch (err) {
      console.error('Error adding asset:', err);
    }
  };

  const handleDeleteAsset = async (assetId) => {
    try {
      await axios.delete(`/api/assets/${assetId}`);
      setAssets(assets.filter(a => a._id !== assetId));
    } catch (err) {
      console.error('Delete asset error:', err);
    }
  };

  const filteredAssets = assets.filter((a) => assetMatchesSearch(a, searchTerm));
  const hasSearch = searchTerm.trim().length > 0;

  if (loading) return <div className="p-20 text-center animate-pulse text-[var(--color-text-muted)] font-black uppercase tracking-widest">Loading Assets...</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <SearchInput
          placeholder="Search assets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:max-w-md shrink-0"
        />
        <Button
          type="button"
          size="sm"
          className="shrink-0 w-full sm:w-auto"
          onClick={() => {
            setNewAsset({ name: '', link: '', type: 'other', projectIds: [projectId], notes: '' });
            setShowAddModal(true);
          }}
        >
          <Plus size={14} /> Add Asset Link
        </Button>
      </div>

      <Card className="overflow-hidden border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--color-bg-workspace)]/50 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] border-b border-[var(--color-bg-border)]">
              <tr>
                <th className="px-8 py-5">Asset Name</th>
                <th className="px-8 py-5">Link / Resource</th>
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-border)]">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center opacity-30">
                    <Database size={48} className="mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase">
                      {hasSearch && assets.length > 0 ? 'No assets match your search' : 'No assets for this project'}
                    </p>
                  </td>
                </tr>
              ) : filteredAssets.map(asset => {
                const hasLink = Boolean(asset.link?.trim());
                return (
                  <tr
                    key={asset._id}
                    onClick={() => { if (hasLink) openAssetLink(asset.link); }}
                    className={`hover:bg-[var(--color-bg-secondary)]/50 transition-all group ${hasLink ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3 min-w-0">
                        <AssetTypeIconBadge type={asset.type} link={asset.link} size={14} className="shrink-0" />
                        <span
                          className="text-xs font-black text-[var(--color-text-primary)] uppercase tracking-tight truncate"
                          title={asset.name}
                        >
                          {asset.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {hasLink ? (
                        <span
                          className="text-[9px] font-bold text-blue-500 truncate block max-w-[200px]"
                          title={asset.link}
                        >
                          {asset.link.replace(/^https?:\/\//i, '')}
                        </span>
                      ) : (
                        <span className="text-[9px] italic opacity-30">—</span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
                      {format(new Date(asset.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAsset(asset._id);
                        }}
                        className="p-2 text-[var(--color-text-muted)] hover:text-rose-500 transition-colors"
                        title="Delete asset"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <AnimatePresence>
        {showAddModal && (
          <div className="tm-modal-overlay fixed inset-0 z-[200] p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="tm-modal-panel max-w-md bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-[2.5rem] shadow-2xl overflow-hidden p-8" role="dialog" aria-modal="true">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black uppercase tracking-tight text-[var(--color-text-primary)]">Add Project Asset</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-xl text-[var(--color-text-muted)]"><X size={18} /></button>
              </div>
              <form onSubmit={handleAddAsset} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Asset Title</label>
                  <input 
                    type="text" 
                    value={newAsset.name}
                    onChange={e => setNewAsset({...newAsset, name: e.target.value})}
                    required
                    placeholder="Documentation, Style Guide, etc."
                    className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl px-5 py-3 text-xs font-bold outline-none text-[var(--color-text-primary)]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Resource URL</label>
                  <input 
                    type="text" 
                    value={newAsset.link}
                    onChange={e => setNewAsset({...newAsset, link: e.target.value})}
                    required
                    placeholder="https://drive.google.com/..."
                    className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl px-5 py-3 text-xs font-bold outline-none text-[var(--color-text-primary)]"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Asset Type</label>
                  <NexusDropdown 
                    options={ASSET_TYPE_FORM_OPTIONS}
                    value={newAsset.type} 
                    onChange={(val) => setNewAsset({ ...newAsset, type: val })} 
                    placeholder="Select Asset Type"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Associated Projects</label>
                  <NexusDropdown 
                    isMulti
                    options={projects.map(p => ({ value: p._id, label: p.name }))} 
                    value={newAsset.projectIds || []} 
                    onChange={(val) => setNewAsset({ ...newAsset, projectIds: Array.isArray(val) ? val : [val].filter(Boolean) })} 
                    placeholder="Select Projects"
                    searchable
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Notes</label>
                  <p className="text-[9px] text-[var(--color-text-muted)] ml-1">Private — not shown in the project asset list.</p>
                  <textarea
                    value={newAsset.notes || ''}
                    onChange={(e) => setNewAsset({ ...newAsset, notes: e.target.value })}
                    placeholder="Internal notes about this link..."
                    rows={4}
                    className="w-full min-h-[88px] px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl text-xs font-bold outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-y focus:border-[var(--color-action-primary)]/50"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:bg-blue-700 transition-all"
                >
                  Confirm Asset
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectAssets;
