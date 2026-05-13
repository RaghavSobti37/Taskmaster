import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Search, 
  Plus, 
  Clock, 
  Filter as FilterIcon, 
  TrendingUp, 
  UserCheck, 
  Phone,
  History,
  Shield,
  ChevronRight,
  AlertCircle,
  Calendar,
  CheckCircle2,
  FileText,
  Trash2,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Settings,
  Database,
  Link,
  RefreshCw,
  Eye,
  FileJson,
  BarChart3,
  Download,
  Upload,
  Mail,
  ArrowUpRight,
  Star,
  X
} from 'lucide-react';
import { NexusModal } from '../components/ui';
import CRMLeadModal from '../components/crm/CRMLeadModal';
import { useAuth } from '../contexts/AuthContext';
import { getRepName, SALES_REPS } from '../utils/crmUtils';

const CRMPage = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [modal, setModal] = useState({ open: false, title: '', message: '', type: 'info' });
  const [activeSubPage, setActiveSubPage] = useState('leads'); 
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef(null);

  // Filters
  const [filters, setFilters] = useState({
    leadStatus: 'All',
    callStatus: 'All',
    webinarDates: 'All',
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

    const handleSubpageChange = (e) => {
      setActiveSubPage(e.detail);
    };
    window.addEventListener('crm-subpage-change', handleSubpageChange);
    return () => window.removeEventListener('crm-subpage-change', handleSubpageChange);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

    // Search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(l => 
        l.name.toLowerCase().includes(s) || 
        (l.phone && l.phone.includes(s)) || 
        (l.email && l.email.toLowerCase().includes(s))
      );
    }

    // Filters
    if (filters.leadStatus !== 'All') result = result.filter(l => l.leadStatus === filters.leadStatus);
    if (filters.callStatus !== 'All') result = result.filter(l => l.callStatus === filters.callStatus);
    if (filters.webinarDates !== 'All') result = result.filter(l => l.webinarDates === filters.webinarDates);
    if (filters.assignedRepId !== 'All') {
      result = result.filter(l => {
        const rep = l.assignedRepId;
        const repId = typeof rep === 'object' ? rep._id : rep;
        return repId === filters.assignedRepId;
      });
    }
    if (filters.leadQuality !== 'All') result = result.filter(l => String(l.leadQuality) === filters.leadQuality);

    // Sort
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
      case 'Cold': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      case 'Not Interested': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
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

  const uniqueWebinars = useMemo(() => ['All', ...new Set(leads.map(l => l.webinarDates).filter(Boolean))], [leads]);
  
  const activeReps = useMemo(() => {
    const counts = {};
    leads.forEach(l => {
      const rep = l.assignedRepId;
      const id = typeof rep === 'object' ? rep._id : (rep || 'unassigned');
      counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }, [leads]);

  const renderLeadsView = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[var(--color-bg-surface)] px-6 py-4 rounded-3xl border border-[var(--color-bg-border)] shadow-xl shadow-black/5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500 shrink-0">
            <Users size={18} />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black text-[var(--color-text-primary)] uppercase tracking-tight italic">Leads</h1>
            <span className="px-2 py-0.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-full text-[9px] font-black text-blue-500 uppercase tracking-widest">
              {filteredAndSortedLeads.length} Leads
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative group min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="SEARCH LEADS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--color-text-primary)] w-full outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
          </div>
          
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all border ${showFilters ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-[var(--color-bg-workspace)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] hover:border-blue-500/50'}`}
            >
              <FilterIcon size={14} /> Filters
            </button>
            
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-3 w-64 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-[1.5rem] shadow-2xl p-5 z-[80] space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-3">
                    <h4 className="text-[9px] font-black uppercase tracking-widest">Global Filters</h4>
                    <button onClick={() => setFilters({ leadStatus: 'All', callStatus: 'All', webinarDates: 'All', assignedRepId: 'All', leadQuality: 'All' })} className="text-[8px] font-black text-blue-500 uppercase hover:underline">Reset</button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest ml-1">Lead Status</label>
                      <select value={filters.leadStatus} onChange={e => setFilters({...filters, leadStatus: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg px-3 py-2 text-[9px] font-bold outline-none">
                        {['All', 'New', 'Hot', 'Warm', 'Cold', 'Converted', 'Not Interested'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest ml-1">Call Result</label>
                      <select value={filters.callStatus} onChange={e => setFilters({...filters, callStatus: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border(--color-bg-border)] rounded-lg px-3 py-2 text-[9px] font-bold outline-none">
                        {['All', 'Pending', 'Connected', 'Busy', 'DNP', 'Switch Off/Wrong Number'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest ml-1">Quality</label>
                      <select value={filters.leadQuality} onChange={e => setFilters({...filters, leadQuality: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg px-3 py-2 text-[9px] font-bold outline-none">
                        <option value="All">All Quality</option>
                        {['1', '2', '3', '4', '5'].map(opt => <option key={opt} value={opt}>{opt} Stars</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest ml-1">Representative</label>
                      <select value={filters.assignedRepId} onChange={e => setFilters({...filters, assignedRepId: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg px-3 py-2 text-[9px] font-bold outline-none">
                        <option value="All">All Sales Reps</option>
                        {Object.keys(activeReps).map(id => (
                          <option key={id} value={id}>{getRepName(leads.find(l => (typeof l.assignedRepId === 'object' ? l.assignedRepId._id : l.assignedRepId) === id)?.assignedRepId) || id}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => { setSelectedLead(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-blue-500 text-white px-5 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:shadow-lg transition-all active:scale-95 shadow-md shadow-blue-500/10"
          >
            <Plus size={14} /> New Lead
          </button>
        </div>
      </header>

      <div className="bg-[var(--color-bg-surface)] rounded-[1.5rem] border border-[var(--color-bg-border)] overflow-hidden shadow-xl shadow-black/5">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg-workspace)] border-b border-[var(--color-bg-border)]">
                <th className="px-6 py-4 text-left min-w-[180px]">
                  <button onClick={() => requestSort('name')} className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-blue-500 transition-colors">
                    Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                  </button>
                </th>
                <th className="px-6 py-4 text-left min-w-[120px]">
                  <button onClick={() => requestSort('webinarDates')} className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-blue-500 transition-colors">
                    Webinar {sortConfig.key === 'webinarDates' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                  </button>
                </th>
                <th className="px-6 py-4 text-left min-w-[100px]">
                   <button onClick={() => requestSort('leadStatus')} className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-blue-500 transition-colors">
                    Status {sortConfig.key === 'leadStatus' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                  </button>
                </th>
                <th className="px-6 py-4 text-left min-w-[130px]">
                   <button onClick={() => requestSort('callStatus')} className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-blue-500 transition-colors">
                    Result {sortConfig.key === 'callStatus' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                  </button>
                </th>
                <th className="px-6 py-4 text-left min-w-[90px]">
                   <button onClick={() => requestSort('leadQuality')} className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-blue-500 transition-colors">
                    Quality {sortConfig.key === 'leadQuality' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                  </button>
                </th>
                <th className="px-6 py-4 text-left min-w-[130px]">
                   <button onClick={() => requestSort('assignedRepId')} className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-blue-500 transition-colors">
                    Representative {sortConfig.key === 'assignedRepId' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-border)]">
              {filteredAndSortedLeads.slice(0, 10).map((lead) => (
                <tr 
                  key={lead._id} 
                  onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }}
                  className="hover:bg-[var(--color-bg-workspace)] transition-all group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 max-w-[180px]">
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-border)] flex items-center justify-center text-xs font-black text-[var(--color-text-primary)] border border-transparent group-hover:border-blue-500 transition-all shrink-0">
                        {lead.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-[var(--color-text-primary)] uppercase tracking-tight truncate" title={lead.name}>{lead.name}</p>
                        <p className="text-[8px] text-[var(--color-text-muted)] font-mono truncate" title={lead.email || lead.phone}>{lead.email || lead.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[9px] font-bold text-[var(--color-text-secondary)] uppercase truncate max-w-[120px]" title={lead.webinarDates || '—'}>
                    {lead.webinarDates || '—'}
                  </td>
                  <td className="px-6 py-4 shrink-0">
                    <span className={`px-2 py-1 rounded-md text-[7px] font-black uppercase tracking-widest border ${getStatusColor(lead.leadStatus)}`}>
                      {lead.leadStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[9px] font-bold text-[var(--color-text-secondary)] uppercase truncate max-w-[130px]" title={lead.callStatus || '—'}>
                    {lead.callStatus || '—'}
                  </td>
                  <td className="px-6 py-4">
                    {getQualityStars(lead.leadQuality)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5 max-w-[150px]">
                      <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center overflow-hidden shrink-0">
                        {typeof lead.assignedRepId === 'object' && lead.assignedRepId.avatar ? (
                          <img src={lead.assignedRepId.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[8px] font-black text-blue-500 uppercase">
                            {getRepName(lead.assignedRepId).substring(0, 2)}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-[var(--color-text-primary)] uppercase tracking-tight truncate" title={getRepName(lead.assignedRepId)}>
                        {getRepName(lead.assignedRepId)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAndSortedLeads.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] opacity-30 italic">No leads discovered in current view</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );

  const renderFollowupsView = () => {
    const overdue = leads.filter(l => l.nextFollowupDate && new Date(l.nextFollowupDate) < new Date().setHours(0,0,0,0));
    const today = leads.filter(l => l.nextFollowupDate && new Date(l.nextFollowupDate).toDateString() === new Date().toDateString());
    const upcoming = leads.filter(l => l.nextFollowupDate && new Date(l.nextFollowupDate) > new Date());

    const Column = ({ title, items, color }) => (
      <div className="bg-[var(--color-bg-surface)] rounded-[1.5rem] border border-[var(--color-bg-border)] p-4 space-y-4 flex-1 flex flex-col min-w-[280px] shadow-xl shadow-black/5">
        <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">{title}</h3>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black text-white ${color}`}>{items.length}</span>
        </div>
        <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[500px]">
          {items.map(lead => (
            <div 
              key={lead._id} 
              onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }}
              className="p-4 bg-[var(--color-bg-workspace)] rounded-2xl border border-[var(--color-bg-border)] hover:border-blue-500/30 transition-all group cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-black text-[var(--color-text-primary)] uppercase tracking-tight truncate pr-2">{lead.name}</p>
                <div className="p-1 bg-blue-500/10 text-blue-500 rounded-md opacity-0 group-hover:opacity-100 transition-all"><ChevronRight size={12} /></div>
              </div>
              <p className="text-[10px] font-mono text-[var(--color-text-muted)] mb-2">{lead.phone}</p>
              <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest">
                <span className="text-amber-500 flex items-center gap-1"><Clock size={10} /> {lead.nextFollowupDate}</span>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center overflow-hidden shrink-0">
                    {typeof lead.assignedRepId === 'object' && lead.assignedRepId.avatar ? (
                      <img src={lead.assignedRepId.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[7px] font-black text-blue-500 uppercase">
                        {getRepName(lead.assignedRepId).substring(0, 2)}
                      </span>
                    )}
                  </div>
                  <span className="text-[var(--color-text-muted)]">REP: {getRepName(lead.assignedRepId)}</span>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 opacity-20 text-[var(--color-text-muted)]">
              <CheckCircle2 size={32} className="mb-2" />
              <p className="text-[8px] font-black uppercase tracking-widest">Protocol Clear</p>
            </div>
          )}
        </div>
      </div>
    );

    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        <header>
          <h1 className="text-2xl font-black text-[var(--color-text-primary)] uppercase tracking-tight italic">Follow-up protocols</h1>
          <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-widest">Sync prioritization active.</p>
        </header>

        <div className="flex flex-col lg:flex-row gap-6">
          <Column title="Overdue" items={overdue} color="bg-rose-500 shadow-md" />
          <Column title="Due Today" items={today} color="bg-amber-500 shadow-md" />
          <Column title="Upcoming" items={upcoming} color="bg-blue-500 shadow-md" />
        </div>
      </motion.div>
    );
  };

  const renderDashboardView = () => {
    const stats = [
      { label: 'Database', value: leads.length, icon: Database, color: 'text-blue-500', bg: 'bg-blue-500/10' },
      { label: 'Connected', value: leads.filter(l => l.callStatus === 'Connected').length, icon: Phone, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
      { label: 'Meaningful', value: leads.filter(l => l.meaningfulConnect === 'YES').length, icon: UserCheck, color: 'text-purple-500', bg: 'bg-purple-500/10' },
      { label: 'Converted', value: leads.filter(l => l.leadStatus === 'Converted').length, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    ];

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="space-y-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="bg-[var(--color-bg-surface)] p-6 rounded-[1.5rem] border border-[var(--color-bg-border)] shadow-xl shadow-black/5 group hover:border-blue-500 transition-all">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <stat.icon size={20} />
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">{stat.label}</p>
              <h2 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tighter">{stat.value}</h2>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[var(--color-bg-surface)] p-8 rounded-[2rem] border border-[var(--color-bg-border)] shadow-2xl shadow-black/5">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-primary)] mb-6 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" /> Pipeline Analytics
            </h3>
            <div className="space-y-6">
              {[
                { label: 'Total Base', value: leads.length, percent: 100, color: 'bg-blue-500' },
                { label: 'Connected', value: leads.filter(l => l.callStatus === 'Connected').length, percent: (leads.filter(l => l.callStatus === 'Connected').length / leads.length * 100) || 0, color: 'bg-emerald-500' },
                { label: 'Meaningful', value: leads.filter(l => l.meaningfulConnect === 'YES').length, percent: (leads.filter(l => l.meaningfulConnect === 'YES').length / leads.length * 100) || 0, color: 'bg-purple-500' },
                { label: 'Converted', value: leads.filter(l => l.leadStatus === 'Converted').length, percent: (leads.filter(l => l.leadStatus === 'Converted').length / leads.length * 100) || 0, color: 'bg-amber-500' },
              ].map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                    <span className="text-[var(--color-text-primary)]">{item.label}</span>
                    <span className="text-[var(--color-text-muted)]">{item.value} ({Math.round(item.percent)}%)</span>
                  </div>
                  <div className="h-2.5 bg-[var(--color-bg-workspace)] rounded-full overflow-hidden border border-[var(--color-bg-border)] shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percent}%` }}
                      className={`h-full rounded-full ${item.color} shadow-md`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--color-bg-surface)] p-6 rounded-[1.5rem] border border-[var(--color-bg-border)] shadow-2xl shadow-black/5 flex flex-col">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-primary)] mb-4">Representative Sync</h3>
            <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
              {Object.entries(activeReps).map(([id, count]) => {
                const lead = leads.find(l => (typeof l.assignedRepId === 'object' ? l.assignedRepId._id : l.assignedRepId) === id);
                const name = getRepName(lead?.assignedRepId) || id;
                return (
                  <div key={id} className="flex items-center justify-between p-3 bg-[var(--color-bg-workspace)] rounded-xl border border-[var(--color-bg-border)] hover:border-blue-500 transition-all group">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center overflow-hidden shrink-0">
                        {typeof lead?.assignedRepId === 'object' && lead.assignedRepId.avatar ? (
                          <img src={lead.assignedRepId.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] font-black text-blue-500 uppercase">
                            {name.substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-[var(--color-text-primary)] uppercase truncate" title={name}>{name}</span>
                    </div>
                    <span className="text-[9px] font-black text-blue-500 shrink-0">{count} Leads</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderReportsView = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
       <header>
          <h1 className="text-2xl font-black text-[var(--color-text-primary)] uppercase tracking-tight italic">Performance intelligence</h1>
          <p className="text-[9px] text-[var(--color-text-muted)] mt-1 font-bold uppercase tracking-widest italic">Live data stream active</p>
       </header>

       <div className="bg-[var(--color-bg-surface)] rounded-[1.5rem] border border-[var(--color-bg-border)] overflow-hidden shadow-2xl">
         <div className="overflow-x-auto">
           <table className="w-full">
              <thead className="bg-[var(--color-bg-workspace)] border-b border-[var(--color-bg-border)]">
                <tr>
                  <th className="px-6 py-4 text-left text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Rep Identity</th>
                  <th className="px-6 py-4 text-center text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Assigned</th>
                  <th className="px-6 py-4 text-center text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Connected</th>
                  <th className="px-6 py-4 text-center text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Meaningful</th>
                  <th className="px-6 py-4 text-center text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Converted</th>
                  <th className="px-6 py-4 text-center text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-bg-border)]">
                {Object.entries(activeReps).map(([id, count]) => {
                  const repLeads = leads.filter(l => (typeof l.assignedRepId === 'object' ? l.assignedRepId._id : l.assignedRepId) === id);
                  const conv = repLeads.filter(l => l.leadStatus === 'Converted').length;
                  const rate = repLeads.length > 0 ? ((conv / repLeads.length) * 100).toFixed(1) : 0;
                  const name = getRepName(repLeads[0]?.assignedRepId) || id;
                  return (
                    <tr key={id} className="hover:bg-[var(--color-bg-workspace)] transition-all group">
                      <td className="px-6 py-4 truncate max-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center overflow-hidden shrink-0">
                            {typeof repLeads[0]?.assignedRepId === 'object' && repLeads[0].assignedRepId.avatar ? (
                              <img src={repLeads[0].assignedRepId.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-black text-blue-500 uppercase">
                                {name.substring(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="font-black text-[var(--color-text-primary)] uppercase tracking-tight italic truncate" title={name}>{name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-xs font-bold text-[var(--color-text-secondary)]">{repLeads.length}</td>
                      <td className="px-6 py-4 text-center text-xs font-bold text-emerald-500">{repLeads.filter(l => l.callStatus === 'Connected').length}</td>
                      <td className="px-6 py-4 text-center text-xs font-bold text-purple-500">{repLeads.filter(l => l.meaningfulConnect === 'YES').length}</td>
                      <td className="px-6 py-4 text-center text-xs font-bold text-amber-500">{conv}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded-md text-[9px] font-black border border-blue-500/10">{rate}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
           </table>
         </div>
       </div>
    </motion.div>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-4 pb-24">
      <NexusModal 
        isOpen={modal.open}
        onClose={() => setModal({ ...modal, open: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      <AnimatePresence mode="wait">
        {activeSubPage === 'leads' && renderLeadsView()}
        {activeSubPage === 'dashboard' && renderDashboardView()}
        {activeSubPage === 'followups' && renderFollowupsView()}
        {activeSubPage === 'reports' && renderReportsView()}
      </AnimatePresence>

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
