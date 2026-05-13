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
  Layers,
  ChevronRight,
  PlusCircle,
  X,
  Shield,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Badge, NexusModal } from '../components/ui';
import { format } from 'date-fns';

const AssetsPage = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create Asset Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAsset, setNewAsset] = useState({
    projectId: '',
    name: '',
    links: ['', '', '']
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assetsRes, projectsRes] = await Promise.all([
        axios.get('/api/assets'),
        axios.get('/api/projects')
      ]);
      setAssets(assetsRes.data);
      setProjects(projectsRes.data);
    } catch (err) {
      console.error('Error fetching assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsset = async (e) => {
    e.preventDefault();
    if (!newAsset.projectId || !newAsset.name) return;

    setSubmitting(true);
    try {
      const filteredLinks = newAsset.links.filter(l => l.trim() !== '');
      const res = await axios.post('/api/assets', {
        ...newAsset,
        links: filteredLinks
      });
      setAssets([res.data, ...assets]);
      setShowAddModal(false);
      setNewAsset({ projectId: '', name: '', links: ['', '', ''] });
    } catch (err) {
      console.error('Add asset error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAsset = async (id) => {
    if (!window.confirm("PERMANENTLY DECOMMISSION THIS ASSET BUNDLE?")) return;
    try {
      await axios.delete(`/api/assets/${id}`);
      setAssets(assets.filter(a => a._id !== id));
    } catch (err) {
      console.error('Delete asset error:', err);
    }
  };

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.projectId?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Loading Asset Inventory...</p>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 pb-24 px-4 sm:px-6 lg:px-8">
      {/* Premium Header */}
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between pt-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500 border border-blue-500/20 shadow-xl">
              <Database size={20} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--color-text-primary)] uppercase">Resource Vault</h1>
          </div>
          <p className="text-[10px] font-bold text-[var(--color-text-muted)] ml-14 uppercase tracking-widest">Centralized project assets & critical links.</p>
        </div>

        <div className="flex items-center gap-3">
           <div className="relative hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={14} />
            <input 
              type="text" 
              placeholder="Scan inventory..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 py-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none w-64 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus size={14} strokeWidth={3} /> Register Asset
          </button>
        </div>
      </motion.header>

      {/* Main Table Interface */}
      <motion.section 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--color-bg-workspace)]/50 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] border-b border-[var(--color-bg-border)]">
              <tr>
                <th className="px-10 py-6">Mission Unit</th>
                <th className="px-10 py-6">Resource Specification</th>
                <th className="px-10 py-6">Access Nodes (Max 3)</th>
                <th className="px-10 py-6">Operative</th>
                <th className="px-10 py-6 text-right">Protocol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-border)]">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-10 py-32 text-center">
                    <div className="opacity-20 flex flex-col items-center gap-4">
                      <Shield size={48} />
                      <p className="text-xs font-black uppercase tracking-widest">No assets indexed in this sector.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredAssets.map((asset) => (
                <tr key={asset._id} className="hover:bg-blue-500/5 transition-all group">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[var(--color-bg-workspace)] rounded-lg text-blue-500 border border-[var(--color-bg-border)] group-hover:border-blue-500/30 transition-all">
                        <Briefcase size={14} />
                      </div>
                      <span className="text-xs font-black text-[var(--color-text-primary)] uppercase tracking-tight">{asset.projectId?.name || 'Global System'}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="space-y-0.5">
                      <p className="text-sm font-black text-[var(--color-text-primary)] group-hover:text-blue-600 transition-colors">{asset.name}</p>
                      <p className="text-[9px] font-bold text-[var(--color-text-muted)]">{format(new Date(asset.createdAt), 'MMM d, yyyy')}</p>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-2">
                      {asset.links.map((link, idx) => (
                        <a 
                          key={idx}
                          href={link.startsWith('http') ? link : `https://${link}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-[9px] font-black text-blue-500 hover:bg-blue-500 hover:text-white transition-all uppercase tracking-widest shadow-sm"
                        >
                          <Link2 size={10} /> Node {idx + 1}
                        </a>
                      ))}
                      {asset.links.length === 0 && <span className="text-[10px] text-[var(--color-text-muted)] italic">No links registered.</span>}
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center font-black text-[8px] text-blue-400">
                        {asset.createdBy?.name?.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[10px] font-black text-[var(--color-text-secondary)] uppercase">{asset.createdBy?.name}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                    {(user.role === 'admin' || user._id === asset.createdBy?._id) && (
                      <button 
                        onClick={() => handleDeleteAsset(asset._id)}
                        className="p-2.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                    <h2 className="text-xl font-black text-[var(--color-text-primary)] uppercase tracking-tight">Resource Registration</h2>
                    <p className="text-[10px] text-[var(--color-text-muted)] font-black uppercase tracking-widest">Index a new project asset bundle.</p>
                  </div>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2.5 hover:bg-[var(--color-bg-border)] rounded-xl transition-all"><X size={18} /></button>
              </header>

              <form onSubmit={handleAddAsset} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Target Mission</label>
                    <select 
                      value={newAsset.projectId}
                      onChange={e => setNewAsset({ ...newAsset, projectId: e.target.value })}
                      required
                      className="w-full px-4 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner appearance-none cursor-pointer"
                    >
                      <option value="">Select Project...</option>
                      {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </div>
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

                <div className="space-y-4 pt-2">
                  <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Access Nodes (Max 3)</label>
                  <div className="space-y-3">
                    {newAsset.links.map((link, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                          <Link2 size={14} />
                        </div>
                        <input 
                          type="text" 
                          placeholder={`Access Link ${idx + 1}...`}
                          value={link}
                          onChange={e => {
                            const updatedLinks = [...newAsset.links];
                            updatedLinks[idx] = e.target.value;
                            setNewAsset({ ...newAsset, links: updatedLinks });
                          }}
                          className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-500 uppercase tracking-widest">Node {idx + 1}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full py-4 bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50 active:scale-[0.98] mt-4"
                >
                  {submitting ? 'Synchronizing Vault...' : 'Commit to Database'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssetsPage;
