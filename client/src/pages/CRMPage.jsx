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

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const res = await axios.get('/api/crm/leads');
      setLeads(res.data);
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

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
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon size={20} />
              </div>
              <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Snapshot</span>
            </div>
            <h4 className="text-2xl font-black text-[var(--color-text-primary)] mb-1">{stat.value}</h4>
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 xl:grid-cols-3 gap-6"
      >
        <AnimatePresence mode="popLayout">
          {filteredLeads.map((lead) => (
            <motion.div
              key={lead._id}
              layout
              variants={itemVariants}
              onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }}
              className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] p-6 hover:border-blue-500/30 transition-all cursor-pointer group relative overflow-hidden"
            >
              {/* Status Ribbon */}
              <div className={`absolute top-0 right-0 px-4 py-1 rounded-bl-xl text-[8px] font-black uppercase tracking-widest border-l border-b ${getStatusColor(lead.leadStatus)}`}>
                {lead.leadStatus}
              </div>

              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-bg-workspace)] flex items-center justify-center text-xl font-black text-blue-500 border border-[var(--color-bg-border)] shadow-inner">
                  {lead.name[0]}
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-[var(--color-text-primary)] uppercase tracking-tight group-hover:text-blue-500 transition-colors">
                    {lead.name}
                  </h3>
                  <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1"><Phone size={10} /> {lead.phone}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 rounded-xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)]">
                  <p className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1">Lead Quality</p>
                  <p className="text-xs font-bold text-[var(--color-text-primary)]">Priority: {lead.leadQuality}</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)]">
                  <p className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1">Call Status</p>
                  <p className="text-xs font-bold text-[var(--color-text-primary)]">{lead.callStatus}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[var(--color-bg-border)]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-[10px] text-white font-bold">
                    {lead.assignedRepId?.name[0] || '?'}
                  </div>
                  <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
                    {lead.assignedRepId?.name || 'Unassigned'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-blue-500 text-[10px] font-black uppercase tracking-widest">
                  Operate <ChevronRight size={14} />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
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
