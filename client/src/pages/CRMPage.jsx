import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Search, 
  Plus, 
  Filter, 
  ChevronRight, 
  Phone, 
  Mail, 
  Clock, 
  Shield,
  CreditCard,
  History,
  Lock,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserCheck,
  Calendar,
  MessageSquare
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Badge, NexusModal } from '../components/ui';
import CRMLeadModal from '../components/crm/CRMLeadModal';

const CRMPage = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [filter, setFilter] = useState('All');

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/crm/leads');
      setLeads(res.data);
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePriority = async (leadId, quality) => {
    try {
      await axios.put(`/api/crm/leads/${leadId}`, { leadQuality: quality });
      fetchLeads();
    } catch (err) {
      console.error('Update priority error:', err);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(search.toLowerCase()) || 
                          lead.phone.includes(search);
    const matchesFilter = filter === 'All' || lead.leadStatus === filter;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'New': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Hot': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'Warm': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Converted': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Cold': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      await axios.post('/api/crm/leads/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchLeads();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to upload leads');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-20">
      {/* Premium Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 rounded-xl text-blue-500 shadow-2xl border border-white/5">
              <Users size={20} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--color-text-primary)] uppercase">
              Operative CRM
            </h1>
          </div>
          <p className="text-xs font-medium text-[var(--color-text-muted)] ml-14">Management of potential converts and lead lifecycles.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text"
              placeholder="Search Identity/Signal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 pr-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold w-full md:w-64 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>
          
          <button 
            onClick={fetchLeads}
            disabled={loading}
            className="p-3 bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] rounded-xl border border-[var(--color-bg-border)] hover:text-blue-500 hover:border-blue-500/50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Sync Signals"
          >
            <Clock size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          <label className="flex items-center gap-2 bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] px-5 py-3 rounded-xl border border-[var(--color-bg-border)] font-black text-[10px] uppercase tracking-widest hover:bg-[var(--color-bg-workspace)] transition-all cursor-pointer shadow-sm active:scale-95">
            <Plus size={16} /> Import Leads
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>

          <button 
            onClick={() => { setSelectedLead(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-blue-500/10 active:scale-95"
          >
            <Plus size={16} /> New Lead
          </button>
        </div>
      </motion.header>

      {/* Analytics Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Active Leads', value: leads.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Hot Prospects', value: leads.filter(l => l.leadStatus === 'Hot').length, icon: TrendingUp, color: 'text-rose-500', bg: 'bg-rose-500/10' },
          { label: 'Conversions', value: leads.filter(l => l.leadStatus === 'Converted').length, icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Pending Calls', value: leads.filter(l => l.callStatus === 'Pending').length, icon: Phone, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        ].map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-[var(--color-bg-surface)] p-6 rounded-3xl border border-[var(--color-bg-border)] shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-3">
                <h3 className="text-2xl font-black text-[var(--color-text-primary)]">{stat.value}</h3>
                <p className={`text-[10px] font-black uppercase tracking-widest ${stat.color} opacity-80`}>{stat.label}</p>
              </div>
              <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} group-hover:rotate-12 transition-transform`}>
                <stat.icon size={20} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Table View */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] overflow-hidden shadow-sm"
      >
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg-workspace)] border-b border-[var(--color-bg-border)]">
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Operative Identity</th>
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Signal (Phone)</th>
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Deployment (Status)</th>
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Assigned Rep</th>
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Priority</th>
                <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-border)]">
              <AnimatePresence mode="popLayout">
                {filteredLeads.map((lead) => (
                  <motion.tr
                    key={lead._id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-blue-500/5 transition-all group border-b border-[var(--color-bg-border)] last:border-0"
                  >
                    <td className="px-8 py-5 cursor-pointer" onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-sm font-black text-white border border-white/5">
                          {lead.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-black text-[var(--color-text-primary)] uppercase tracking-tight group-hover:text-blue-500 transition-colors">{lead.name}</p>
                          <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">{lead.email || 'NO_EMAIL'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 cursor-pointer" onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }}>
                      <span className="text-[11px] font-bold text-[var(--color-text-primary)] font-mono">{lead.phone}</span>
                    </td>
                    <td className="px-8 py-5">
                       <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getStatusColor(lead.leadStatus)}`}>
                        {lead.leadStatus}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                       <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-black ${lead.assignedRepId ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                          {lead.assignedRepId?.name?.[0] || '!'}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${lead.assignedRepId ? 'text-[var(--color-text-muted)]' : 'text-rose-500'}`}>
                          {lead.assignedRepId?.name || 'UNASSIGNED'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <select 
                        value={lead.leadQuality} 
                        onChange={(e) => handleUpdatePriority(lead._id, e.target.value)}
                        className="bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-blue-500/20 cursor-pointer outline-none hover:bg-blue-500 hover:text-white transition-all appearance-none"
                      >
                        <option value="1">P1 - CRITICAL</option>
                        <option value="2">P2 - HIGH</option>
                        <option value="3">P3 - MEDIUM</option>
                        <option value="4">P4 - LOW</option>
                        <option value="5">P5 - TRASH</option>
                      </select>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <button 
                        onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg active:scale-95"
                      >
                        Operate
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredLeads.length === 0 && (
            <div className="text-center py-32 opacity-30">
              <Users size={48} className="mx-auto mb-4" />
              <p className="text-xs font-black uppercase tracking-[0.3em]">No operative data discovered</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Modal */}
      <CRMLeadModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        lead={selectedLead}
        onRefresh={fetchLeads}
      />
    </div>
  );
};

export default CRMPage;
