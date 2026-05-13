import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Save, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Clock, 
  Shield, 
  MessageSquare,
  DollarSign,
  Plus,
  Users,
  TrendingUp
} from 'lucide-react';
import axios from 'axios';
import { Badge } from '../ui';
import { format } from 'date-fns';

const CRMLeadModal = ({ isOpen, onClose, lead }) => {
  const [formData, setFormData] = useState({});
  const [emis, setEmis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // details, emis, notes

  useEffect(() => {
    if (lead) {
      setFormData(lead);
      fetchLeadDetails(lead.row_index);
    } else {
      setFormData({
        status: 'New',
        priority: 'Medium',
        source: 'Website'
      });
      setEmis([]);
    }
  }, [lead, isOpen]);

  const fetchLeadDetails = async (rowIndex) => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/crm/leads/${rowIndex}`);
      setFormData(res.data);
      setEmis(res.data.emis || []);
    } catch (err) {
      console.error('Error fetching lead details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (lead) {
        await axios.patch(`/api/crm/leads/${lead.row_index}`, formData);
      } else {
        await axios.post('/api/crm/leads', formData);
      }
      onClose();
    } catch (err) {
      console.error('Error saving lead:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl bg-[var(--color-bg-surface)] rounded-3xl shadow-2xl border border-[var(--color-bg-border)] overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 md:p-6 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)]">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base md:text-lg shadow-lg">
                {formData.name?.[0] || '?'}
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-bold text-[var(--color-text-primary)]">{formData.name || 'New Lead'}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant={formData.status?.toLowerCase() === 'new' ? 'todo' : 'progress'}>{formData.status}</Badge>
                  <span className="text-[8px] md:text-[10px] text-[var(--color-text-muted)] font-black uppercase tracking-widest">ID: {formData.row_id || 'PENDING'}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--color-bg-border)] rounded-lg transition-all">
              <X size={18} md:size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-4 md:px-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/50 overflow-x-auto no-scrollbar">
            {['details', 'emis', 'notes'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 md:px-6 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                  activeTab === tab 
                    ? 'border-[var(--color-action-primary)] text-[var(--color-action-primary)]' 
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            {activeTab === 'details' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                    <Users size={14} /> Basic Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">Full Name</label>
                      <input 
                        type="text" 
                        value={formData.name || ''} 
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full px-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">Email</label>
                        <input 
                          type="email" 
                          value={formData.email || ''} 
                          onChange={e => setFormData({...formData, email: e.target.value})}
                          className="w-full px-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">Phone</label>
                        <input 
                          type="text" 
                          value={formData.phone || ''} 
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                          className="w-full px-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">Location</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={16} />
                        <input 
                          type="text" 
                          value={formData.location || ''} 
                          onChange={e => setFormData({...formData, location: e.target.value})}
                          className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                    <TrendingUp size={14} /> Pipeline Status
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">Status</label>
                      <select 
                        value={formData.status || 'New'} 
                        onChange={e => setFormData({...formData, status: e.target.value})}
                        className="w-full px-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      >
                        <option>New</option>
                        <option>Contacted</option>
                        <option>Qualified</option>
                        <option>Proposal Sent</option>
                        <option>Negotiation</option>
                        <option>Closed Won</option>
                        <option>Closed Lost</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">Assigned To</label>
                      <input 
                        type="text" 
                        value={formData.assigned_to || ''} 
                        onChange={e => setFormData({...formData, assigned_to: e.target.value})}
                        className="w-full px-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        placeholder="Rep ID or Name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">Budget</label>
                        <input 
                          type="text" 
                          value={formData.budget || ''} 
                          onChange={e => setFormData({...formData, budget: e.target.value})}
                          className="w-full px-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">Priority</label>
                        <select 
                          value={formData.priority || 'Medium'} 
                          onChange={e => setFormData({...formData, priority: e.target.value})}
                          className="w-full px-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        >
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                          <option>Urgent</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'emis' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-muted)]">EMIs</h3>
                  <button className="flex items-center gap-2 text-xs font-bold text-[var(--color-action-primary)] hover:underline">
                    <Plus size={14} /> Add
                  </button>
                </div>
                <div className="border border-[var(--color-bg-border)] rounded-2xl overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs md:text-sm min-w-[500px]">
                    <thead>
                      <tr className="bg-[var(--color-bg-workspace)]">
                        <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Date</th>
                        <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Amount</th>
                        <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Status</th>
                        <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-bg-border)]">
                      {emis.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="px-4 py-12 text-center text-[var(--color-text-muted)] italic">No payments scheduled.</td>
                        </tr>
                      ) : emis.map((emi, i) => (
                        <tr key={i} className="hover:bg-[var(--color-bg-workspace)]/50">
                          <td className="px-4 py-3">{emi.due_date}</td>
                          <td className="px-4 py-3 font-bold">₹{emi.amount}</td>
                          <td className="px-4 py-3">
                            <Badge variant={emi.status === 'Paid' ? 'done' : 'todo'}>{emi.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text-muted)]">{emi.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-4">
                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">Internal Notes</label>
                <textarea 
                  rows="10"
                  value={formData.notes || ''} 
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-4 py-4 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                  placeholder="Enter details about interactions, requirements, etc."
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 md:p-6 border-t border-[var(--color-bg-border)] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[var(--color-bg-workspace)]">
            <div className="flex items-center gap-4 text-[var(--color-text-muted)]">
              {formData.locked_by && (
                <div className="flex items-center gap-1.5 text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-orange-500">
                  <Shield size={10} md:size={12} /> Locked by {formData.locked_by}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button onClick={onClose} className="flex-1 sm:flex-none px-4 md:px-6 py-2.5 rounded-xl text-sm font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-border)] transition-all">
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[var(--color-action-primary)] text-white px-6 md:px-8 py-2.5 rounded-xl font-bold hover:bg-[var(--color-action-hover)] transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 text-sm"
              >
                {saving ? 'Saving...' : <><Save size={16} md:size={18} /> Save</>}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CRMLeadModal;
