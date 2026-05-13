import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Search, 
  Plus, 
  Filter as FilterIcon, 
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Star,
  RefreshCw
} from 'lucide-react';
import { NexusModal, NexusLoader } from '../components/ui';
import CRMLeadModal from '../components/crm/CRMLeadModal';
import { useAuth } from '../contexts/AuthContext';
import { getRepName } from '../utils/crmUtils';

const LeadsPage = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const filterRef = useRef(null);

  const [filters, setFilters] = useState({
    leadStatus: 'All',
    callStatus: 'All',
    assignedRepId: 'All',
    leadQuality: 'All'
  });

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

  useEffect(() => {
    fetchLeads();
  }, []);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedLeads = useMemo(() => {
    let result = [...leads];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(l => 
        l.name.toLowerCase().includes(s) || 
        (l.phone && l.phone.includes(s)) || 
        (l.email && l.email.toLowerCase().includes(s))
      );
    }
    if (filters.leadStatus !== 'All') result = result.filter(l => l.leadStatus === filters.leadStatus);
    if (filters.callStatus !== 'All') result = result.filter(l => l.callStatus === filters.callStatus);
    if (filters.assignedRepId !== 'All') {
      result = result.filter(l => {
        const rep = l.assignedRepId;
        const repId = typeof rep === 'object' ? rep._id : rep;
        return repId === filters.assignedRepId;
      });
    }
    if (filters.leadQuality !== 'All') result = result.filter(l => String(l.leadQuality) === filters.leadQuality);

    result.sort((a, b) => {
      let valA = a[sortConfig.key] || '';
      let valB = b[sortConfig.key] || '';
      if (sortConfig.key === 'leadQuality') {
        valA = parseInt(valA) || 0;
        valB = parseInt(valB) || 0;
      } else if (sortConfig.key === 'assignedRepId') {
        valA = getRepName(valA).toLowerCase();
        valB = getRepName(valB).toLowerCase();
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [leads, search, filters, sortConfig]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'New': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Hot': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'Warm': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Converted': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getQualityStars = (quality) => {
    const q = parseInt(quality) || 1;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} size={10} className={i <= q ? 'fill-amber-500 text-amber-500' : 'text-slate-700'} />
        ))}
      </div>
    );
  };

  if (loading) return <NexusLoader label="Leads Sync In Progress" sublabel="Fetching Unified Dataset" />;

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8 pb-24 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[var(--color-bg-surface)] px-6 py-4 rounded-3xl border border-[var(--color-bg-border)] shadow-xl shadow-black/5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500 shrink-0">
            <Users size={18} />
          </div>
          <div>
            <h1 className="text-lg font-black text-[var(--color-text-primary)] uppercase tracking-tight italic">Leads Database</h1>
            <p className="text-[9px] text-[var(--color-text-muted)] font-black uppercase tracking-[0.2em]">{filteredAndSortedLeads.length} Total Units</p>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative group min-w-[240px]">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="SEARCH LEADS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--color-text-primary)] w-full outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
          </div>
          
          <button
            onClick={() => { setSelectedLead(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:shadow-lg transition-all active:scale-95"
          >
            <Plus size={14} /> New Lead
          </button>
        </div>
      </header>

      <div className="bg-[var(--color-bg-surface)] rounded-[2rem] border border-[var(--color-bg-border)] overflow-hidden shadow-xl shadow-black/5">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--color-bg-workspace)] border-b border-[var(--color-bg-border)]">
                <th className="px-8 py-5 text-left min-w-[200px]">
                  <button onClick={() => requestSort('name')} className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-blue-500">
                    Lead Identity {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                  </button>
                </th>
                <th className="px-8 py-5 text-left">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Status</span>
                </th>
                <th className="px-8 py-5 text-left">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Quality</span>
                </th>
                <th className="px-8 py-5 text-left">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Representative</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-border)]">
              {filteredAndSortedLeads.map((lead) => (
                <tr 
                  key={lead._id} 
                  onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }}
                  className="hover:bg-[var(--color-bg-workspace)] transition-all group cursor-pointer"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-border)] flex items-center justify-center font-black text-xs text-[var(--color-text-primary)] border border-transparent group-hover:border-blue-500 transition-all">
                        {lead.name[0]}
                      </div>
                      <div>
                        <p className="text-xs font-black text-[var(--color-text-primary)] uppercase tracking-tight">{lead.name}</p>
                        <p className="text-[9px] text-[var(--color-text-muted)] font-bold">{lead.phone || lead.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${getStatusColor(lead.leadStatus)}`}>
                      {lead.leadStatus}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    {getQualityStars(lead.leadQuality)}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-[9px] font-black text-blue-500 uppercase">
                        {getRepName(lead.assignedRepId).substring(0, 2)}
                      </div>
                      <span className="text-[10px] font-bold text-[var(--color-text-primary)] uppercase tracking-tight">
                        {getRepName(lead.assignedRepId)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CRMLeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        lead={selectedLead}
        onRefresh={fetchLeads}
      />
    </div>
  );
};

export default LeadsPage;
