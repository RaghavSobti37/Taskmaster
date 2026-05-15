import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  ExternalLink, 
  Plus, 
  Trash2, 
  Search, 
  Link2,
  Briefcase
} from 'lucide-react';
import { Card, Badge, NexusDropdown } from '../ui';
import { format } from 'date-fns';

const ProjectAssets = ({ projectId }) => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAsset, setNewAsset] = useState({ name: '', link: '' });

  useEffect(() => {
    fetchAssets();
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

  const handleAddAsset = async (e) => {
    e.preventDefault();
    if (!newAsset.name) return;
    try {
      const res = await axios.post('/api/assets', {
        projectId,
        name: newAsset.name,
        link: newAsset.link
      });
      setAssets([res.data, ...assets]);
      setShowAddModal(false);
      setNewAsset({ name: '', link: '' });
    } catch (err) {
      console.error('Error adding asset:', err);
    }
  };

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-20 text-center animate-pulse text-[var(--color-text-muted)] font-black uppercase tracking-widest">Loading Assets...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input 
            type="text" 
            placeholder="Search assets..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none"
          />
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus size={14} strokeWidth={3} /> Add Asset
        </button>
      </div>

      <Card className="overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.2em]">
              <tr>
                <th className="px-8 py-5">Asset Name</th>
                <th className="px-8 py-5">Link / Resource</th>
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center opacity-30">
                    <Database size={48} className="mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase">No assets for this project</p>
                  </td>
                </tr>
              ) : filteredAssets.map(asset => (
                <tr key={asset._id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Link2 size={14} /></div>
                      <span className="text-sm font-black text-slate-800 uppercase italic tracking-tight">{asset.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <a 
                      href={asset.link.startsWith('http') ? asset.link : `https://${asset.link}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg text-[9px] font-black text-blue-600 hover:bg-blue-600 hover:text-white transition-all uppercase tracking-[0.2em]"
                    >
                      <ExternalLink size={12} /> Open Resource
                    </a>
                  </td>
                  <td className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {format(new Date(asset.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white w-full max-w-md rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black uppercase italic text-slate-900">Add Project Asset</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-50 rounded-xl"><X size={18} /></button>
              </div>
              <form onSubmit={handleAddAsset} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Title</label>
                  <input 
                    type="text" 
                    value={newAsset.name}
                    onChange={e => setNewAsset({...newAsset, name: e.target.value})}
                    required
                    placeholder="Documentation, Style Guide, etc."
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-xs font-bold outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Resource URL</label>
                  <input 
                    type="text" 
                    value={newAsset.link}
                    onChange={e => setNewAsset({...newAsset, link: e.target.value})}
                    required
                    placeholder="https://drive.google.com/..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-xs font-bold outline-none"
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:bg-slate-800 transition-all"
                >
                  Confirm Asset
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const X = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

export default ProjectAssets;
