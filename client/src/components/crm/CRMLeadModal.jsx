import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Save, 
  Trash2, 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar, 
  Clock, 
  Shield, 
  CreditCard, 
  History,
  Lock,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import CKDropdown from '../ui/CKDropdown';

const CRMLeadModal = ({ isOpen, onClose, lead, onRefresh }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({});
  const [emis, setEmis] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [lockStatus, setLockStatus] = useState(null);

  useEffect(() => {
    if (lead) {
      setFormData(lead);
      fetchEmis();
      fetchAuditLogs();
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        leadStatus: 'New',
        callStatus: 'Pending',
        leadQuality: '1',
        attended: 'N',
        meaningfulConnect: 'NO'
      });
      setEmis([]);
      setAuditLogs([]);
    }
  }, [lead, isOpen]);

  const fetchEmis = async () => {
    try {
      const res = await axios.get(`/api/crm/leads/${lead._id}/emis`);
      setEmis(res.data);
    } catch (err) {
      console.error('Error fetching EMIs:', err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await axios.get(`/api/crm/leads/${lead._id}/audit`);
      setAuditLogs(res.data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (lead) {
        await axios.put(`/api/crm/leads/${lead._id}`, formData);
      } else {
        await axios.post('/api/crm/leads', formData);
      }
      onRefresh();
      onClose();
    } catch (err) {
      if (err.response?.status === 423) {
        setLockStatus('Locked by another operative');
      } else {
        alert(err.response?.data?.error || 'Failed to save lead');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmi = async () => {
    try {
      const installmentNo = emis.length + 1;
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + 1);
      
      await axios.post(`/api/crm/leads/${lead._id}/emis`, {
        installmentNo,
        amount: 0,
        dueDate: dueDate.toISOString(),
        status: 'Pending'
      });
      fetchEmis();
    } catch (err) {
      console.error('Error creating EMI:', err);
    }
  };

  const handleUpdateEmi = async (emiId, updates) => {
    try {
      await axios.put(`/api/crm/emis/${emiId}`, updates);
      fetchEmis();
    } catch (err) {
      console.error('Error updating EMI:', err);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'profile', label: 'Profile', icon: FileText },
    { id: 'emis', label: 'EMI Tracking', icon: CreditCard },
    { id: 'audit', label: 'Audit History', icon: History }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-5xl bg-[var(--color-bg-surface)] rounded-[3rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <header className="p-8 border-b border-[var(--color-bg-border)] bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-black border border-white/5">
              {formData.name?.[0] || 'L'}
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">{lead ? 'Edit Operative' : 'New Lead Capture'}</h3>
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                {lead ? `UID: ${lead._id}` : 'Initializing Personnel Data'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
            <X size={20} />
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="flex bg-[var(--color-bg-workspace)]/50 border-b border-[var(--color-bg-border)] p-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-xl' : 'text-[var(--color-text-muted)] hover:bg-white/5'}`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gradient-to-br from-transparent to-[var(--color-bg-workspace)]/20">
          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-10"
              >
                {lockStatus && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-500">
                    <Lock size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{lockStatus}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] border-b border-blue-500/10 pb-2">Core Identity</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Personnel Name</label>
                        <input 
                          type="text" 
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full px-4 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Signal (Phone)</label>
                          <input 
                            type="text" 
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            className="w-full px-4 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Email Node</label>
                          <input 
                            type="email" 
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            className="w-full px-4 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] border-b border-emerald-500/10 pb-2">Operational Data</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <CKDropdown 
                        label="Lead Status"
                        options={['New', 'Hot', 'Warm', 'Cold', 'Token Received', 'Converted', 'Not Interested'].map(v => ({ value: v, label: v.toUpperCase() }))}
                        value={formData.leadStatus}
                        onChange={(v) => setFormData({...formData, leadStatus: v})}
                      />
                      <CKDropdown 
                        label="Call Status"
                        options={['Pending', 'Connected', 'Busy', 'DNP', 'Switch Off/Wrong Number'].map(v => ({ value: v, label: v.toUpperCase() }))}
                        value={formData.callStatus}
                        onChange={(v) => setFormData({...formData, callStatus: v})}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-[var(--color-bg-border)]">
                   <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Operative Remarks</label>
                   <textarea 
                    rows="4"
                    value={formData.remarks}
                    onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                    className="w-full px-4 py-4 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                    placeholder="Log tactical observations here..."
                   />
                </div>
              </motion.div>
            )}

            {activeTab === 'emis' && (
              <motion.div
                key="emis"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black uppercase tracking-tight">EMI Tracking Schedule</h4>
                  <button 
                    onClick={handleCreateEmi}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                  >
                    <Plus size={14} /> Add Installment
                  </button>
                </div>

                <div className="bg-[var(--color-bg-workspace)]/40 border border-[var(--color-bg-border)] rounded-[2rem] overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[var(--color-bg-workspace)] border-b border-[var(--color-bg-border)]">
                        <th className="px-6 py-4 text-left text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">No.</th>
                        <th className="px-6 py-4 text-left text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Due Date</th>
                        <th className="px-6 py-4 text-left text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Amount</th>
                        <th className="px-6 py-4 text-left text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-bg-border)]">
                      {emis.map(emi => (
                        <tr key={emi._id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-xs font-black text-blue-500">{emi.installmentNo}</td>
                          <td className="px-6 py-4">
                             <input 
                              type="date"
                              value={new Date(emi.dueDate).toISOString().split('T')[0]}
                              onChange={(e) => handleUpdateEmi(emi._id, { dueDate: e.target.value })}
                              className="bg-transparent text-xs font-bold outline-none focus:text-blue-500"
                             />
                          </td>
                          <td className="px-6 py-4">
                             <input 
                              type="number"
                              value={emi.amount}
                              onChange={(e) => handleUpdateEmi(emi._id, { amount: e.target.value })}
                              className="bg-transparent text-xs font-bold outline-none focus:text-blue-500 w-24"
                             />
                          </td>
                          <td className="px-6 py-4">
                             <button
                              onClick={() => handleUpdateEmi(emi._id, { status: emi.status === 'Paid' ? 'Pending' : 'Paid', paidAt: emi.status === 'Paid' ? null : new Date() })}
                              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${emi.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}
                             >
                               {emi.status}
                             </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'audit' && (
              <motion.div
                key="audit"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  {auditLogs.map(log => (
                    <div key={log._id} className="bg-[var(--color-bg-workspace)]/40 p-5 rounded-2xl border border-[var(--color-bg-border)] flex items-start gap-4">
                      <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500">
                        <History size={16} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-tight">
                            <span className="text-blue-500">{log.userId?.name}</span> changed <span className="text-white">{log.fieldChanged}</span>
                          </p>
                          <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest flex items-center gap-1">
                            <Clock size={10} /> {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                           <span className="px-2 py-1 bg-red-500/5 text-red-500 text-[9px] font-bold rounded-md border border-red-500/10 line-through opacity-60">{log.oldValue || 'NULL'}</span>
                           <ChevronRight size={12} className="text-[var(--color-text-muted)]" />
                           <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[9px] font-black rounded-md border border-emerald-500/20">{log.newValue}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <div className="text-center py-20 opacity-40">
                      <History size={48} className="mx-auto mb-4" />
                      <p className="text-xs font-black uppercase tracking-[0.2em]">No audit logs discovered</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="p-8 border-t border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/80 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <Shield size={16} className="text-[var(--color-text-muted)]" />
              <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">End-to-End Encryption Active</span>
           </div>
           <div className="flex items-center gap-4">
             <button onClick={onClose} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hover:text-white transition-all">Cancel</button>
             <button 
              onClick={handleSave}
              disabled={loading || !!lockStatus}
              className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-800 disabled:opacity-30 transition-all shadow-xl active:scale-95"
             >
               {loading ? 'Processing...' : <><Save size={16} /> Sync Changes</>}
             </button>
           </div>
        </footer>
      </motion.div>
    </div>
  );
};

export default CRMLeadModal;
