import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  ExternalLink, 
  Plus, 
  Trash2, 
  Link2,
  Cloud,
  Lock,
  Globe,
  FileText,
  X
} from 'lucide-react';
import { Card, Badge, NexusDropdown, SearchInput, Button } from '../ui';
import { format } from 'date-fns';

const ProjectAssets = ({ projectId }) => {
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAsset, setNewAsset] = useState({ name: '', link: '', type: 'other', projectIds: [projectId] });

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
        type: newAsset.type || 'other'
      });
      // Only append to screen list if it matches the current project
      if (newAsset.projectIds.includes(projectId)) {
        setAssets([res.data, ...assets]);
      }
      setShowAddModal(false);
      setNewAsset({ name: '', link: '', type: 'other', projectIds: [projectId] });
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
          icon: Lock,
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

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            setNewAsset({ name: '', link: '', type: 'other', projectIds: [projectId] });
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
                    <p className="text-[10px] font-black uppercase">No assets for this project</p>
                  </td>
                </tr>
              ) : filteredAssets.map(asset => {
                const typeConfig = getAssetTypeConfig(asset.type, asset.link);
                const TypeIcon = typeConfig.icon;
                return (
                  <tr key={asset._id} className="hover:bg-[var(--color-bg-secondary)]/50 transition-all group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${typeConfig.colorClass}`}>
                          <TypeIcon size={14} />
                        </div>
                        <span className="text-xs font-black text-[var(--color-text-primary)] uppercase tracking-tight">{asset.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <a 
                        href={asset.link.startsWith('http') ? asset.link : `https://${asset.link}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-[9px] font-black text-blue-500 hover:bg-blue-500/10 transition-all uppercase tracking-wider"
                      >
                        <ExternalLink size={12} /> Open Link
                      </a>
                    </td>
                    <td className="px-8 py-5 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
                      {format(new Date(asset.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button 
                        onClick={() => handleDeleteAsset(asset._id)}
                        className="p-2 text-[var(--color-text-muted)] hover:text-rose-500 transition-colors"
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
