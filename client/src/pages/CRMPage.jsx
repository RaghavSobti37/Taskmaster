import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  Search, 
  Filter, 
  Plus, 
  ChevronRight, 
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { Badge } from '../components/ui';
import { format } from 'date-fns';
import CRMLeadModal from '../components/crm/CRMLeadModal';

const CRMPage = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, new: 0, contacted: 0, qualified: 0 });

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/crm/leads?search=${search}`);
      setLeads(res.data.data || []);
      
      // Calculate stats
      const l = res.data.data || [];
      setStats({
        total: l.length,
        new: l.filter(x => x.status === 'New').length,
        contacted: l.filter(x => x.status === 'Contacted').length,
        qualified: l.filter(x => x.status === 'Qualified').length
      });
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [search]);

  const handleLeadClick = (lead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM Command</h1>
          <p className="text-[var(--color-text-secondary)]">Manage your sales pipeline and leads.</p>
        </div>
        <button 
          onClick={() => { setSelectedLead(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-[var(--color-action-primary)] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[var(--color-action-hover)] transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus size={20} /> Add New Lead
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Leads', value: stats.total, icon: Database, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'New Leads', value: stats.new, icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: 'Contacted', value: stats.contacted, icon: Phone, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Qualified', value: stats.qualified, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' }
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-[var(--color-bg-surface)] p-6 rounded-2xl border border-[var(--color-bg-border)] shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Live</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stat.value}</p>
            <p className="text-xs font-medium text-[var(--color-text-muted)]">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Content */}
      <div className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[var(--color-bg-border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
            <input 
              type="text" 
              placeholder="Search leads by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-action-primary)]/20 transition-all text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-sm font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-border)] transition-all">
              <Filter size={18} /> Filters
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg-workspace)]">
                <th className="px-6 py-4 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest border-b border-[var(--color-bg-border)]">Lead Info</th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest border-b border-[var(--color-bg-border)]">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest border-b border-[var(--color-bg-border)]">Assigned To</th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest border-b border-[var(--color-bg-border)]">Last Activity</th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest border-b border(--color-bg-border)] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-border)]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="5" className="px-6 py-8 h-16 bg-gray-50/50"></td>
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center text-[var(--color-text-muted)] italic">No leads found.</td>
                </tr>
              ) : leads.map((lead) => (
                <tr 
                  key={lead.row_index} 
                  className="hover:bg-[var(--color-bg-workspace)] transition-all cursor-pointer group"
                  onClick={() => handleLeadClick(lead)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                        {lead.name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">{lead.name}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">{lead.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={lead.status?.toLowerCase() === 'new' ? 'todo' : lead.status?.toLowerCase() === 'closed won' ? 'done' : 'progress'}>
                      {lead.status || 'NEW'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-200 border border-[var(--color-bg-border)] flex items-center justify-center text-[8px] font-bold">
                        {lead.assigned_to?.[0] || 'U'}
                      </div>
                      <span className="text-xs font-medium text-[var(--color-text-secondary)]">{lead.assigned_to || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {lead.last_contact ? format(new Date(lead.last_contact), 'MMM d, yyyy') : 'No contact'}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-[var(--color-bg-border)] rounded-lg text-[var(--color-text-muted)] transition-all">
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CRMLeadModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); fetchLeads(); }}
        lead={selectedLead}
      />
    </div>
  );
};

export default CRMPage;
