import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  ChevronRight,
  CheckCircle2,
  Calendar,
  Filter
} from 'lucide-react';
import { NexusLoader, PageHeader, PageContainer, Card } from '../components/ui';
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

  const fetchLeads = async () => {
    try {
      setLoading(true);
      // Fetch all leads that have a followup date
      const res = await axios.get('/api/crm/leads', { params: { limit: 1000, hasFollowup: 'true' } });
      setLeads(res.data.leads || []);
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const overdue = leads.filter(l => {
    const d = normalizeDate(l.nextFollowupDate);
    return d && d < now && l.leadStatus !== 'Converted';
  });

  const today = leads.filter(l => {
    const d = normalizeDate(l.nextFollowupDate);
    return d && d.getTime() === now.getTime() && l.leadStatus !== 'Converted';
  });

  const upcoming = leads.filter(l => {
    const d = normalizeDate(l.nextFollowupDate);
    return d && d > now && l.leadStatus !== 'Converted';
  });

  const ColumnSkeleton = () => (
    <div className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] p-8 space-y-6 flex-1 flex flex-col min-w-[320px] animate-pulse">
      <div className="h-4 w-32 bg-slate-200 rounded mb-4" />
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-slate-100 rounded-2xl border border-slate-200" />
        ))}
      </div>
    </div>
  );

  const Column = ({ title, items, color }) => (
    <div className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] p-8 space-y-6 flex-1 flex flex-col min-w-[320px] shadow-2xl shadow-black/5">
      <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-5">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-primary)]">{title}</h3>
        <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${color} shadow-lg shadow-black/10`}>{items.length} Leads</span>
      </div>
      <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[60vh]">
        {items.map(lead => (
          <motion.div 
            key={lead._id} 
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }}
            className="p-5 bg-[var(--color-bg-workspace)] rounded-2xl border border-[var(--color-bg-border)] hover:border-blue-500/30 transition-all group cursor-pointer shadow-sm"
          >
            <div className="flex justify-between items-start mb-3">
              <p className="text-xs font-black text-[var(--color-text-primary)] uppercase tracking-tight truncate pr-4">{lead.name}</p>
              <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><ChevronRight size={14} /></div>
            </div>
            <p className="text-[10px] font-mono text-[var(--color-text-muted)] mb-4">{lead.phone || 'NO PHONE'}</p>
            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-bg-border)]">
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                <Clock size={12} /> {lead.nextFollowupDate ? new Date(lead.nextFollowupDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'NOT SET'}
              </span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-[8px] font-black text-blue-500 uppercase">
                  {getRepName(lead.assignedRepId).substring(0, 2)}
                </div>
                <span className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">REP: {getRepName(lead.assignedRepId).split(' ')[0]}</span>
              </div>
            </div>
          </motion.div>
        ))}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 opacity-20 text-[var(--color-text-muted)]">
            <CheckCircle2 size={48} className="mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em]">All Clear</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Follow-ups"
        subtitle="Track and manage your upcoming follow-ups."
        icon={Clock}
      />

      <div className="flex flex-col xl:flex-row gap-8">
        {loading ? (
          <>
            <ColumnSkeleton />
            <ColumnSkeleton />
            <ColumnSkeleton />
          </>
        ) : (
          <>
            <Column title="Overdue" items={overdue} color="bg-rose-500" />
            <Column title="Due Today" items={today} color="bg-amber-500" />
            <Column title="Upcoming" items={upcoming} color="bg-blue-500" />
          </>
        )}
      </div>

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
