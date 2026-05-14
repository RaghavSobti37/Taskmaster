import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  ChevronRight,
  CheckCircle2,
  Calendar,
  Filter,
  ChevronLeft,
  ArrowUpDown,
  Search,
  RefreshCw,
  Database,
  Edit2
} from 'lucide-react';
import { NexusLoader, PageHeader, PageContainer, Card, Badge } from '../components/ui';
import CRMLeadModal from '../components/crm/CRMLeadModal';
import { getRepName } from '../utils/crmUtils';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const FollowupsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'sales') {
      navigate('/');
    }
  }, [user, navigate]);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'nextFollowupDate', direction: 'asc' });

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: pageSize,
        search: searchTerm,
        hasFollowup: 'true',
        notStatus: 'Converted',
        sort: sortConfig.key,
        order: sortConfig.direction
      };
      
      const res = await axios.get('/api/crm/leads', { params });
      
      // The logic for "Today's on top, then overdue, then upcoming"
      // We'll do this client-side sorting or handle it via multi-fetch if needed.
      // But user asked for a tabular format with this specific priority.
      
      let allLeads = res.data.leads || [];
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const normalizeDate = (d) => {
        if (!d) return null;
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        return date;
      };

      // Priority: Today (0), Overdue (1), Upcoming (2)
      const sortedLeads = [...allLeads].sort((a, b) => {
        const dA = normalizeDate(a.nextFollowupDate);
        const dB = normalizeDate(b.nextFollowupDate);
        
        if (!dA) return 1;
        if (!dB) return -1;

        const timeA = dA.getTime();
        const timeB = dB.getTime();
        const timeNow = now.getTime();

        const getPriority = (t) => {
          if (t === timeNow) return 0;
          if (t < timeNow) return 1;
          return 2;
        };

        const pA = getPriority(timeA);
        const pB = getPriority(timeB);

        if (pA !== pB) return pA - pB;
        
        // If same priority, sort by date
        return timeA - timeB;
      });

      setLeads(sortedLeads);
      setTotalPages(res.data.pages || 1);
      setTotalLeads(res.data.total || 0);
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [page, pageSize, sortConfig]);

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

  const LeadsSkeleton = () => (
    <div className="space-y-4 animate-pulse">
      <div className="h-12 bg-slate-200 rounded-xl w-full" />
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="h-16 bg-slate-100 rounded-xl w-full border border-slate-200" />
      ))}
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Follow-ups"
        subtitle="Manage your scheduled client connections."
        icon={Clock}
      />

      <Card className="p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-blue-500 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search leads..."
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
              </select>
            </div>
            <button onClick={fetchLeads} className="p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl hover:bg-[var(--color-bg-surface)] transition-all active:scale-95 text-[var(--color-text-muted)] hover:text-blue-500">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
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
                      Lead Name <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    <button onClick={() => handleSort('nextFollowupDate')} className="flex items-center gap-2 hover:text-blue-500 transition-colors">
                      Follow-up Date <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    Priority Status
                  </th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    Assigned Rep
                  </th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-bg-border)]">
                {leads.map(lead => {
                  const fDate = new Date(lead.nextFollowupDate);
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);
                  const isToday = new Date(lead.nextFollowupDate).setHours(0,0,0,0) === now.getTime();
                  const isOverdue = new Date(lead.nextFollowupDate) < new Date() && !isToday;
                  
                  return (
                    <tr key={lead._id} className="hover:bg-blue-500/5 transition-all group">
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-black text-[var(--color-text-primary)] uppercase tracking-tight">{lead.name}</span>
                          <span className="text-[9px] font-mono text-[var(--color-text-muted)]">{lead.phone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <Clock size={12} className={isOverdue ? 'text-rose-500' : isToday ? 'text-amber-500' : 'text-blue-500'} />
                          <span className={`text-[10px] font-black uppercase ${isOverdue ? 'text-rose-600' : isToday ? 'text-amber-600' : 'text-[var(--color-text-primary)]'}`}>
                            {new Date(lead.nextFollowupDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <Badge variant={isOverdue ? 'todo' : isToday ? 'progress' : 'done'}>
                          {isToday ? 'DUE TODAY' : isOverdue ? 'OVERDUE' : 'UPCOMING'}
                        </Badge>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] flex items-center justify-center text-[10px] font-black text-blue-500 uppercase">
                            {getRepName(lead.assignedRepId).substring(0, 2)}
                          </div>
                          <span className="text-[10px] font-black text-[var(--color-text-primary)] uppercase">{getRepName(lead.assignedRepId)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }}
                          className="p-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl hover:bg-blue-600 hover:text-white transition-all active:scale-90"
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-8 py-6 bg-[var(--color-bg-workspace)]/50 border-t border-[var(--color-bg-border)] flex items-center justify-between">
          <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
            Showing <span className="text-[var(--color-text-primary)]">{leads.length}</span> of <span className="text-[var(--color-text-primary)]">{totalLeads}</span> follow-ups
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl disabled:opacity-30 hover:border-blue-500 transition-all"
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
              className="p-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl disabled:opacity-30 hover:border-blue-500 transition-all"
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
};

export default FollowupsPage;
