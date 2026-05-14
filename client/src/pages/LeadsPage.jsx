import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Download,
  Upload,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Mail,
  Phone,
  User,
  Clock,
  Trash2,
  Edit2,
  RefreshCw,
  Database,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { Badge, NexusModal, NexusDropdown } from '../components/ui';
import CRMLeadModal from '../components/crm/CRMLeadModal';
import { getRepName } from '../utils/crmUtils';

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  
  const [filters, setFilters] = useState({
    leadQuality: 'all',
    callStatus: 'all',
    leadStatus: 'all',
    assignedRepId: 'all'
  });
  
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [selectedLead, setSelectedLead] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reps, setReps] = useState([]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: pageSize,
        search: searchTerm,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== 'all')),
        sort: sortConfig.key,
        order: sortConfig.direction
      };
      
      const res = await axios.get('/api/crm/leads', { params });
      setLeads(res.data.leads || []);
      setTotalPages(res.data.pages || 1);
      setTotalLeads(res.data.total || 0);
      
      const repsRes = await axios.get('/api/users/directory');
      // Only show sales reps who have a profile picture
      setReps(repsRes.data.users?.filter(u => u.role === 'sales' && u.avatar) || []);
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [page, pageSize, filters, sortConfig]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) setPage(1);
      else fetchLeads();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleExport = async () => {
    try {
      const res = await axios.get('/api/export?format=db', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const LeadsSkeleton = () => (
    <div className="space-y-4 animate-pulse">
      <div className="h-12 bg-slate-200 rounded-xl w-full" />
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
        <div key={i} className="h-16 bg-slate-100 rounded-xl w-full border border-slate-200" />
      ))}
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8 pb-24 space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-[var(--color-text-primary)] uppercase tracking-tighter italic">Lead Ecosystem</h1>
          <p className="text-[10px] text-[var(--color-text-muted)] font-black uppercase tracking-[0.4em] mt-2 italic">Neural Matrix Lead Distribution</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-blue-500/50 transition-all shadow-sm">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => { setSelectedLead(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
            <Plus size={16} /> New Lead
          </button>
        </div>
      </header>

      <section className="bg-[var(--color-bg-surface)] p-6 rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-2xl shadow-black/5 space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-blue-500 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Search by name, email, or phone..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl text-xs font-bold outline-none focus:border-blue-500/50 transition-all shadow-inner"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[var(--color-bg-workspace)] px-4 py-2.5 rounded-2xl border border-[var(--color-bg-border)] shadow-inner">
              <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase">Show</span>
              <select 
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="bg-transparent text-xs font-black outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <button onClick={fetchLeads} className="p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl hover:bg-[var(--color-bg-surface)] transition-all active:scale-95 text-[var(--color-text-muted)] hover:text-blue-500">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NexusDropdown 
            options={[{value: 'all', label: 'All Qualities'}, {value: '1', label: '1 - Low'}, {value: '2', label: '2'}, {value: '3', label: '3'}, {value: '4', label: '4'}, {value: '5', label: '5 - High'}]}
            value={filters.leadQuality}
            onChange={v => setFilters(prev => ({...prev, leadQuality: v}))}
            placeholder="Lead Quality"
          />
          <NexusDropdown 
            options={[{value: 'all', label: 'All Call Status'}, {value: 'Pending', label: 'Pending'}, {value: 'Connected', label: 'Connected'}, {value: 'Busy', label: 'Busy'}, {value: 'DNP', label: 'DNP'}, {value: 'Switched Off', label: 'Switched Off'}]}
            value={filters.callStatus}
            onChange={v => setFilters(prev => ({...prev, callStatus: v}))}
            placeholder="Call Status"
          />
          <NexusDropdown 
            options={[{value: 'all', label: 'All Lead Status'}, {value: 'New', label: 'New'}, {value: 'Interested', label: 'Interested'}, {value: 'Not Interested', label: 'Not Interested'}, {value: 'Followup', label: 'Followup'}, {value: 'Converted', label: 'Converted'}]}
            value={filters.leadStatus}
            onChange={v => setFilters(prev => ({...prev, leadStatus: v}))}
            placeholder="Lead Status"
          />
          <NexusDropdown 
            options={[{value: 'all', label: 'All Reps'}, ...reps.map(r => ({value: r._id, label: r.name}))]}
            value={filters.assignedRepId}
            onChange={v => setFilters(prev => ({...prev, assignedRepId: v}))}
            placeholder="Assigned Rep"
          />
        </div>
      </section>

      <section className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-2xl shadow-black/5 overflow-hidden">
        {loading && leads.length === 0 ? (
          <div className="p-12"><LeadsSkeleton /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-bg-workspace)]/50 border-b border-[var(--color-bg-border)]">
                  <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    <button onClick={() => handleSort('name')} className="flex items-center gap-2 hover:text-blue-500 transition-colors">
                      Identity <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Profile</th>
                  <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] text-center">Quality</th>
                  <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Status</th>
                  <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Assigned Rep</th>
                  <th className="px-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-bg-border)]">
                {leads.map(lead => (
                  <tr key={lead._id} className="hover:bg-blue-500/5 transition-all group">
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-black text-[var(--color-text-primary)] group-hover:text-blue-600 transition-colors uppercase tracking-tight">{lead.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-mono text-[var(--color-text-muted)]">{lead.phone}</span>
                          {lead.email && <span className="text-[9px] font-mono text-[var(--color-text-muted)]">• {lead.email}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{lead.artistType || 'N/A'}</span>
                        <span className="text-[9px] font-medium text-[var(--color-text-muted)] italic">{lead.primaryRole || 'No role defined'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-black text-xs ${
                        lead.leadQuality === '5' ? 'bg-emerald-500 text-white' :
                        lead.leadQuality === '4' ? 'bg-blue-500 text-white' :
                        lead.leadQuality === '3' ? 'bg-amber-500 text-white' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {lead.leadQuality}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-1.5">
                        <Badge variant={lead.leadStatus === 'Converted' ? 'done' : lead.leadStatus === 'Followup' ? 'progress' : 'todo'}>
                          {lead.leadStatus.toUpperCase()}
                        </Badge>
                        <span className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-tighter">CALL: {lead.callStatus}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] flex items-center justify-center text-[10px] font-black text-blue-500 uppercase shadow-inner">
                          {lead.assignedRepId?.avatar ? <img src={lead.assignedRepId.avatar} className="w-full h-full object-cover rounded-lg" /> : getRepName(lead.assignedRepId).substring(0, 2)}
                        </div>
                        <span className="text-[10px] font-black text-[var(--color-text-primary)] uppercase">{getRepName(lead.assignedRepId)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button 
                        onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }}
                        className="p-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-90"
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-8 py-32 text-center">
                      <div className="flex flex-col items-center justify-center opacity-20">
                        <Database size={48} className="mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Zero Leads Detected in Matrix</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-8 py-6 bg-[var(--color-bg-workspace)]/50 border-t border-[var(--color-bg-border)] flex items-center justify-between">
          <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
            Showing <span className="text-[var(--color-text-primary)]">{leads.length}</span> of <span className="text-[var(--color-text-primary)]">{totalLeads}</span> Units
          </p>
          <div className="flex items-center gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl disabled:opacity-30 hover:border-blue-500 transition-all active:scale-90"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl">
              <span className="text-[10px] font-black text-blue-500">{page}</span>
              <span className="text-[10px] font-black text-[var(--color-text-muted)]">/</span>
              <span className="text-[10px] font-black text-[var(--color-text-muted)]">{totalPages}</span>
            </div>
            <button 
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl disabled:opacity-30 hover:border-blue-500 transition-all active:scale-90"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      <CRMLeadModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        lead={selectedLead}
        onRefresh={fetchLeads}
      />
    </div>
  );
}
