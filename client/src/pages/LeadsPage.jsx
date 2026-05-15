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
import { Badge, NexusModal, NexusDropdown, PageHeader, Card, PageContainer } from '../components/ui';
import CRMLeadModal from '../components/crm/CRMLeadModal';
import { getRepName } from '../utils/crmUtils';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LeadsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'sales') {
      navigate('/');
    }
  }, [user, navigate]);

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
    assignedRepId: 'all',
    webinarDates: 'all',
    meaningfulConnect: 'all'
  });

  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [selectedLead, setSelectedLead] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reps, setReps] = useState([]);
  const [config, setConfig] = useState({
    callStatuses: [],
    leadStatuses: [],
    qualities: [],
    webinarDates: [],
    meaningfulConnectStatuses: []
  });

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

      const [leadsRes, repsRes, configRes] = await Promise.all([
        axios.get('/api/crm/leads', { params }),
        axios.get('/api/users/directory', { params: { limit: 100 } }),
        axios.get('/api/crm/config')
      ]);

      setLeads(leadsRes.data.leads || []);
      setTotalPages(leadsRes.data.pages || 1);
      setTotalLeads(leadsRes.data.total || 0);
      setReps(repsRes.data.users?.filter(u => u.role === 'sales') || []);
      setConfig(configRes.data);
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
    <PageContainer>
      <PageHeader
        title="Leads"
        subtitle={`Database contains ${totalLeads.toLocaleString()} total entries.`}
        icon={Database}
        actions={
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end mr-4">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Global Reach</span>
              <span className="text-lg font-black text-[var(--color-text-primary)] tracking-tighter">{totalLeads.toLocaleString()}</span>
            </div>
            <button onClick={() => { setSelectedLead(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-action-primary)] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[var(--color-action-hover)] transition-all shadow-lg shadow-blue-500/20">
              <Plus size={16} /> New Lead
            </button>
          </div>
        }
      />

      <Card className="p-6 space-y-6">
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
            options={[{ value: 'all', label: 'All Qualities' }, ...config.qualities.map(q => ({ value: q, label: q }))]}
            value={filters.leadQuality}
            onChange={v => setFilters(prev => ({ ...prev, leadQuality: v }))}
            placeholder="Lead Quality"
          />
          <NexusDropdown
            options={[{ value: 'all', label: 'All Call Status' }, ...config.callStatuses.map(s => ({ value: s, label: s.toUpperCase() }))]}
            value={filters.callStatus}
            onChange={v => setFilters(prev => ({ ...prev, callStatus: v }))}
            placeholder="Call Status"
          />
          <NexusDropdown
            options={[{ value: 'all', label: 'All Lead Status' }, ...config.leadStatuses.map(s => ({ value: s, label: s.toUpperCase() }))]}
            value={filters.leadStatus}
            onChange={v => setFilters(prev => ({ ...prev, leadStatus: v }))}
            placeholder="Lead Status"
          />
          <NexusDropdown
            options={[{ value: 'all', label: 'All Reps' }, ...reps.map(r => ({ value: r._id, label: r.name }))]}
            value={filters.assignedRepId}
            onChange={v => setFilters(prev => ({ ...prev, assignedRepId: v }))}
            placeholder="Assigned Rep"
          />
          <NexusDropdown
            options={[{ value: 'all', label: 'All Webinars' }, ...(config.webinarDates || []).map(w => ({ value: w, label: w }))]}
            value={filters.webinarDates}
            onChange={v => setFilters(prev => ({ ...prev, webinarDates: v }))}
            placeholder="Webinar"
          />
          <NexusDropdown
            options={[{ value: 'all', label: 'All Connect' }, ...(config.meaningfulConnectStatuses || []).map(s => ({ value: s, label: s }))]}
            value={filters.meaningfulConnect}
            onChange={v => setFilters(prev => ({ ...prev, meaningfulConnect: v }))}
            placeholder="Meaningful Connect"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading && leads.length === 0 ? (
          <div className="p-12"><LeadsSkeleton /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-bg-workspace)]/50 border-b border-[var(--color-bg-border)]">
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    <button onClick={() => handleSort('name')} className="flex items-center gap-2 hover:text-blue-500 transition-colors">
                      Name <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    <button onClick={() => handleSort('webinarDates')} className="flex items-center gap-2 hover:text-blue-500 transition-colors">
                      Webinar <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    <button onClick={() => handleSort('attendanceDurationMin')} className="flex items-center gap-2 hover:text-blue-500 transition-colors">
                      Time Attended <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    <button onClick={() => handleSort('meaningfulConnect')} className="flex items-center gap-2 hover:text-blue-500 transition-colors">
                      Connect <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    <button onClick={() => handleSort('callStatus')} className="flex items-center gap-2 hover:text-blue-500 transition-colors">
                      Call Status <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] text-center">
                    <button onClick={() => handleSort('leadQuality')} className="flex items-center gap-2 mx-auto hover:text-blue-500 transition-colors">
                      Quality <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    <button onClick={() => handleSort('leadStatus')} className="flex items-center gap-2 hover:text-blue-500 transition-colors">
                      Status <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    <button onClick={() => handleSort('assignedRepId')} className="flex items-center gap-2 hover:text-blue-500 transition-colors">
                      Sales Rep <ArrowUpDown size={12} />
                    </button>
                  </th>

                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-bg-border)]">
                {leads.map(lead => (
                  <tr key={lead._id} className="hover:bg-blue-500/5 transition-all group">
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-black text-[var(--color-text-primary)] group-hover:text-blue-600 transition-colors uppercase tracking-tight">{lead.name}</span>
                        <span className="text-[9px] font-mono text-[var(--color-text-muted)]">{lead.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-tighter whitespace-nowrap">{lead.webinarDates || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-[10px] font-black text-[var(--color-text-primary)]">{lead.attendanceDurationMin || '0'}m</span>
                    </td>
                    <td className="px-6 py-5">
                      <Badge variant={lead.meaningfulConnect === 'YES' ? 'done' : lead.meaningfulConnect === 'NO' ? 'todo' : 'progress'}>
                        {lead.meaningfulConnect || 'PENDING'}
                      </Badge>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{lead.callStatus}</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-black text-xs ${lead.leadQuality === '5' ? 'bg-emerald-500 text-white' :
                        lead.leadQuality === '4' ? 'bg-blue-500 text-white' :
                          lead.leadQuality === '3' ? 'bg-amber-500 text-white' :
                            'bg-slate-200 text-slate-600'
                        }`}>
                        {lead.leadQuality}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {lead.leadStatus === 'Followup' ? (
                        <div className="flex flex-col items-center">
                          <Badge variant="progress" className="w-8 h-8 !rounded-xl flex flex-col items-center justify-center gap-0 leading-none p-0">
                            <span className="text-[8px] opacity-70">F</span>
                            <span className="text-xs font-black">{lead.leadQuality}</span>
                          </Badge>
                        </div>
                      ) : (
                        <Badge variant={lead.leadStatus === 'Converted' ? 'done' : 'todo'}>
                          {lead.leadStatus.toUpperCase()}
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] flex items-center justify-center text-[10px] font-black text-blue-500 uppercase shadow-inner overflow-hidden">
                          {lead.assignedRepId?.avatar ? <img src={lead.assignedRepId.avatar} className="w-full h-full object-cover" /> : getRepName(lead.assignedRepId).substring(0, 2)}
                        </div>
                        <span className="text-[10px] font-black text-[var(--color-text-primary)] uppercase truncate max-w-[100px]">{getRepName(lead.assignedRepId)}</span>
                      </div>
                    </td>

                    <td className="px-6 py-5 text-right">
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
                        <p className="text-[10px] font-black uppercase tracking-[0.4em]">No leads found</p>
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
            Showing <span className="text-[var(--color-text-primary)]">{leads.length}</span> of <span className="text-[var(--color-text-primary)]">{totalLeads}</span> leads
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
      </Card>

      <CRMLeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        lead={selectedLead}
        onRefresh={fetchLeads}
      />
    </PageContainer>
  );
}
