import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Contact, Plus, Edit2, Trash2, Search, Phone, Mail } from 'lucide-react';
import { Modal } from '../../components/ui';

const ContactsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({ name: '', role: '', phone: '', email: '', notes: '' });
  const [search, setSearch] = useState('');
  
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => (await axios.get('/api/contacts')).data
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingContact) {
        return await axios.put(`/api/contacts/${editingContact._id}`, data);
      }
      return await axios.post('/api/contacts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      setIsModalOpen(false);
      setEditingContact(null);
      setFormData({ name: '', role: '', phone: '', email: '', notes: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => await axios.delete(`/api/contacts/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['contacts'])
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.role.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--color-text-primary)] flex items-center gap-3">
            <Contact className="text-blue-500" />
            Important Contacts
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm font-bold tracking-widest uppercase mt-1">Directory of key personnel and partners</p>
        </div>
        <button
          onClick={() => {
            setEditingContact(null);
            setFormData({ name: '', role: '', phone: '', email: '', notes: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-blue-600 transition-colors"
        >
          <Plus size={16} /> Add Contact
        </button>
      </div>

      <div className="bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl p-4">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="SEARCH BY NAME OR ROLE..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold tracking-widest uppercase text-[var(--color-text-primary)] focus:border-blue-500 transition-colors"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-[var(--color-text-secondary)] font-bold tracking-widest uppercase text-sm">Loading Contacts...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContacts.map(contact => (
              <div key={contact._id} className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl p-4 hover:border-blue-500/30 transition-all flex flex-col h-full">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-[var(--color-text-primary)] uppercase tracking-tight">{contact.name}</h3>
                    <p className="text-xs font-bold text-blue-500 tracking-widest uppercase">{contact.role}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingContact(contact); setFormData(contact); setIsModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-500/10">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => { if(confirm('Delete contact?')) deleteMutation.mutate(contact._id); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-500/10">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="mt-4 space-y-2 text-xs font-bold tracking-widest uppercase flex-1">
                  <div className="flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-blue-500 transition-colors">
                    <Phone size={14} /> <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                  </div>
                  {contact.email && (
                    <div className="flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-blue-500 transition-colors">
                      <Mail size={14} /> <a href={`mailto:${contact.email}`}>{contact.email}</a>
                    </div>
                  )}
                </div>
                {contact.notes && (
                  <div className="mt-4 pt-3 border-t border-[var(--color-bg-border)] text-xs text-[var(--color-text-secondary)] italic">
                    {contact.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingContact ? "Update Contact" : "New Contact"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Name</label>
            <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold" />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Role / Position</label>
            <input required type="text" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Phone</label>
              <input required type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Email (Optional)</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm min-h-[80px]" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-bold uppercase tracking-widest text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-border)] rounded-xl">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="px-4 py-2 font-bold uppercase tracking-widest text-xs bg-blue-500 text-white hover:bg-blue-600 rounded-xl">
              {saveMutation.isPending ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ContactsPage;
