import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Save, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Clock, 
  Star, 
  FileText,
  TrendingUp,
  RefreshCw,
  Zap,
  Briefcase,
  MapPin,
  Heart
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CKDropdown from '../ui/CKDropdown';
import { NexusModal } from '../ui';

const CRMLeadModal = ({ isOpen, onClose, lead, onRefresh, onOptimisticUpdate }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [salesReps, setSalesReps] = useState([]);
  const [activeTab, setActiveTab] = useState('identity');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    leadStatus: 'New',
    callStatus: 'Pending',
    leadQuality: '1',
    assignedRepId: 'unassigned',
    webinarDates: '',
    attended: '',
    attendanceDurationMin: '',
    remarks: '',
    nextFollowupDate: '',
    meaningfulConnect: 'NO',
    artistType: '',
    fullTimeWillingness: '',
    planOption: '',
    primaryRole: '',
    learningGoal: '',
    currentJourney: '',
    metadata: {}
  });
  const [config, setConfig] = useState({
    callStatuses: [],
    leadStatuses: [],
    artistTypes: [],
    qualities: []
  });

  const [confirmModal, setConfirmModal] = useState({ open: false, type: 'info', title: '', message: '' });

  useEffect(() => {
    const fetchSalesRepsAndConfig = async () => {
      try {
        const [teamRes, configRes] = await Promise.all([
          axios.get('/api/users/team'),
          axios.get('/api/crm/config')
        ]);
        const team = teamRes.data.team || [];
        const filtered = team
          .filter(u => u.role === 'sales')
          .map(u => ({ value: u._id, label: u.name.toUpperCase(), avatar: u.avatar }));
        setSalesReps(filtered);
        setConfig(configRes.data);
      } catch (err) {
        console.error('Failed to fetch CRM data:', err);
      }
    };

    if (isOpen) {
      fetchSalesRepsAndConfig();
      if (lead) {
        setFormData({
          ...lead,
          assignedRepId: (typeof lead.assignedRepId === 'object' ? lead.assignedRepId._id : lead.assignedRepId) || 'unassigned',
          remarks: lead.remarks || lead.notes || '',
          metadata: lead.metadata || {}
        });
      } else {
        setFormData({
          name: '',
          email: '',
          phone: '',
          leadStatus: 'New',
          callStatus: 'Pending',
          leadQuality: '1',
          assignedRepId: 'unassigned',
          webinarDates: '',
          attended: '',
          attendanceDurationMin: '',
          remarks: '',
          nextFollowupDate: '',
          meaningfulConnect: 'NO',
          artistType: '',
          fullTimeWillingness: '',
          planOption: '',
          primaryRole: '',
          learningGoal: '',
          currentJourney: '',
          metadata: {}
        });
      }
    }
  }, [lead, isOpen]);

  const handleSave = async () => {
    if (!formData.name || !formData.phone) {
      setConfirmModal({
        open: true,
        type: 'warning',
        title: 'Missing Info',
        message: 'Name and Phone are mandatory.'
      });
      return;
    }

    const payload = {
      ...formData,
      assignedRepId: formData.assignedRepId === 'unassigned' ? null : formData.assignedRepId
    };

    // Optimistic Update
    if (lead && onOptimisticUpdate) {
      onOptimisticUpdate({ ...lead, ...payload });
    }

    // Close modal immediately for "background" feel
    onClose();

    try {
      if (lead) {
        await axios.put(`/api/crm/leads/${lead._id}`, payload);
      } else {
        await axios.post('/api/crm/leads', payload);
      }
      onRefresh(); // Refresh to get final server state (with ID if new, etc)
    } catch (err) {
      console.error('Background Sync error:', err);
      // In a real app, we'd show a "Retry" or "Sync Failed" notification here
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'identity', label: 'Identity', icon: User },
    { id: 'profile', label: 'Profile', icon: Briefcase },
    { id: 'protocols', label: 'Schedule', icon: Clock },
    { id: 'logic', label: 'Logic', icon: Zap },
    { id: 'intel', label: 'Intel', icon: FileText },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ scale: 0.95, y: 10, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 10, opacity: 0 }}
        className="bg-[var(--color-bg-surface)] w-full max-w-4xl rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative z-10"
      >
        {/* Header */}
        <header className="px-8 py-5 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20">
              {formData.name ? formData.name[0].toUpperCase() : 'L'}
            </div>
            <div>
              <h2 className="text-lg font-black text-[var(--color-text-primary)] uppercase tracking-tight truncate max-w-[400px]">
                {formData.name || (lead ? 'Profile Update' : 'New Lead')}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                  formData.leadStatus === 'Converted' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                  'bg-blue-500/10 text-blue-500 border-blue-500/20'
                }`}>
                  {formData.leadStatus}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-bg-border)] rounded-xl transition-all">
            <X size={20} className="text-[var(--color-text-muted)]" />
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="px-8 pt-6 pb-2 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/20 flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                activeTab === tab.id 
                  ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20' 
                  : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] hover:border-blue-500/50'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {activeTab === 'identity' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 flex items-center gap-2">
                      <User size={14} /> Contact Info
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                        <input 
                          type="text" 
                          placeholder="NAME"
                          value={formData.name} 
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl px-5 py-3 text-xs font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Phone</label>
                        <input 
                          type="text" 
                          placeholder="PHONE"
                          value={formData.phone} 
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                          className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl px-5 py-3 text-xs font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
                        <input 
                          type="email" 
                          placeholder="EMAIL"
                          value={formData.email} 
                          onChange={e => setFormData({...formData, email: e.target.value})}
                          className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl px-5 py-3 text-xs font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 flex items-center gap-2">
                      <Zap size={14} /> Engagement
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Webinar Date</label>
                        <input 
                          type="text" 
                          value={formData.webinarDates} 
                          onChange={e => setFormData({...formData, webinarDates: e.target.value})}
                          className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl px-5 py-3 text-xs font-bold outline-none shadow-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <CKDropdown 
                          label="Attended"
                          options={[{ value: 'Y', label: 'YES' }, { value: 'N', label: 'NO' }, { value: '', label: '?' }]}
                          value={formData.attended}
                          onChange={v => setFormData({...formData, attended: v})}
                        />
                        <CKDropdown 
                          label="Connect"
                          options={[{ value: 'YES', label: 'YES' }, { value: 'NO', label: 'NO' }, { value: 'PENDING', label: 'PEND' }]}
                          value={formData.meaningfulConnect}
                          onChange={v => setFormData({...formData, meaningfulConnect: v})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 flex items-center gap-2">
                      <Briefcase size={14} /> Artist Profile
                    </h3>
                    <div className="space-y-4">
                      <CKDropdown 
                        label="Artist Category"
                        options={config.artistTypes.map(t => ({ value: t, label: t.toUpperCase() }))}
                        value={formData.artistType}
                        onChange={v => setFormData({...formData, artistType: v})}
                      />
                      <CKDropdown 
                        label="Primary Role"
                        options={[
                          { value: 'Singer', label: 'SINGER' },
                          { value: 'Producer', label: 'PRODUCER' },
                          { value: 'Composer', label: 'COMPOSER' },
                          { value: 'Other', label: 'OTHER' }
                        ]}
                        value={formData.primaryRole}
                        onChange={v => setFormData({...formData, primaryRole: v})}
                      />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 flex items-center gap-2">
                      <Zap size={14} /> Offering
                    </h3>
                    <div className="space-y-4">
                      <CKDropdown 
                        label="Plan Option"
                        options={[
                          { value: 'One-Time', label: 'ONE-TIME' },
                          { value: '3 Mo', label: '3 MONTHS' },
                          { value: '6 Mo', label: '6 MONTHS' },
                          { value: '9 Mo', label: '9 MONTHS' }
                        ]}
                        value={formData.planOption}
                        onChange={v => setFormData({...formData, planOption: v})}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'protocols' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 flex items-center gap-2">
                      <Clock size={14} /> Follow-up Schedule
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Follow-up Date</label>
                        <div className="relative">
                          <Clock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" />
                          <input 
                            type="datetime-local" 
                            value={formData.nextFollowupDate} 
                            onChange={e => setFormData({...formData, nextFollowupDate: e.target.value})}
                            className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl pl-12 pr-5 py-3 text-xs font-bold outline-none shadow-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Lead Quality</label>
                        <div className="flex gap-2 bg-[var(--color-bg-workspace)] p-3 rounded-2xl border border-[var(--color-bg-border)] justify-center shadow-inner">
                          {[1, 2, 3, 4, 5].map(i => (
                            <button key={i} onClick={() => setFormData({...formData, leadQuality: i.toString()})} className="hover:scale-125 transition-transform">
                              <Star size={18} className={i <= parseInt(formData.leadQuality) ? 'fill-amber-500 text-amber-500' : 'text-slate-700'} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'logic' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 flex items-center gap-2">
                      <Zap size={14} /> Status & Assignment
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <CKDropdown 
                          label="Lead Status"
                          options={config.leadStatuses.map(opt => ({ value: opt, label: opt.toUpperCase() }))}
                          value={formData.leadStatus}
                          onChange={v => setFormData({...formData, leadStatus: v})}
                        />
                        <CKDropdown 
                          label="Call Result"
                          options={config.callStatuses.map(opt => ({ value: opt, label: opt.toUpperCase() }))}
                          value={formData.callStatus}
                          onChange={v => setFormData({...formData, callStatus: v})}
                        />
                      </div>
                      <CKDropdown 
                        label="Assigned Rep"
                        options={[
                          { value: 'unassigned', label: 'UNASSIGNED' },
                          ...salesReps
                        ]}
                        value={formData.assignedRepId}
                        onChange={v => setFormData({...formData, assignedRepId: v})}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'intel' && (
                <div className="space-y-6">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 flex items-center gap-2">
                    <FileText size={14} /> Notes & Remarks
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Learning Goal</label>
                        <input 
                          type="text" 
                          value={formData.learningGoal} 
                          onChange={e => setFormData({...formData, learningGoal: e.target.value})}
                          className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl px-5 py-3 text-xs font-bold outline-none shadow-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Internal Remarks</label>
                        <textarea 
                          placeholder="Add notes..."
                          value={formData.remarks} 
                          onChange={e => setFormData({...formData, remarks: e.target.value})}
                          className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl px-5 py-4 text-xs font-bold outline-none shadow-sm min-h-[120px] resize-none focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="px-8 py-5 border-t border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/50 flex items-center justify-end gap-4">
          <button 
            onClick={onClose}
            className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hover:bg-[var(--color-bg-border)] transition-all"
          >
            Discard
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-3 bg-blue-500 text-white px-10 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-2xl hover:shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-blue-500/10"
          >
            {loading ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
            {lead ? 'Save Lead' : 'Create Lead'}
          </button>
        </footer>
      </motion.div>

      <NexusModal 
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({...confirmModal, open: false})}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
};
export default CRMLeadModal;
