import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Building2, Plus, Edit2, Trash2, Search, Contact, Phone, Mail, Layers } from 'lucide-react';
import { Modal } from '../../components/ui';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';

const OfficeAssetsPage = () => {
  const [activeTab, setActiveTab] = useState('assets'); // 'assets' or 'contacts'
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  
  const [assetFormData, setAssetFormData] = useState({ name: '', description: '', category: 'Hardware', currentlyWith: 'Office', status: 'Available', updateNotes: '' });
  const [contactFormData, setContactFormData] = useState({ name: '', role: '', phone: '', email: '', notes: '' });
  const [search, setSearch] = useState('');
  
  const queryClient = useQueryClient();

  const { data: users = [] } = useUserDirectory();

  // Queries
  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['office-assets'],
    queryFn: async () => (await axios.get('/api/office-assets')).data
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => (await axios.get('/api/contacts')).data
  });

  // Mutations for Assets
  const saveAssetMutation = useMutation({
    mutationFn: async (data) => {
      if (editingAsset) return await axios.put(`/api/office-assets/${editingAsset._id}`, data);
      return await axios.post('/api/office-assets', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['office-assets']);
      setIsAssetModalOpen(false);
      setEditingAsset(null);
      setAssetFormData({ name: '', description: '', category: 'Hardware', currentlyWith: 'Office', status: 'Available', updateNotes: '' });
    }
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (id) => await axios.delete(`/api/office-assets/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['office-assets'])
  });

  // Mutations for Contacts
  const saveContactMutation = useMutation({
    mutationFn: async (data) => {
      if (editingContact) return await axios.put(`/api/contacts/${editingContact._id}`, data);
      return await axios.post('/api/contacts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      setIsContactModalOpen(false);
      setEditingContact(null);
      setContactFormData({ name: '', role: '', phone: '', email: '', notes: '' });
    }
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id) => await axios.delete(`/api/contacts/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['contacts'])
  });

  const handleAssetSubmit = (e) => {
    e.preventDefault();
    saveAssetMutation.mutate(assetFormData);
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    saveContactMutation.mutate(contactFormData);
  };

  const filteredAssets = assets.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.currentlyWith.toLowerCase().includes(search.toLowerCase()));
  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.role.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--color-text-primary)] flex items-center gap-3">
            <Building2 className="text-blue-500" />
            Office & Contacts Registry
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm font-bold tracking-widest uppercase mt-1">Manage office assets and important personnel</p>
        </div>
        
        {activeTab === 'assets' ? (
          <button
            onClick={() => {
              setEditingAsset(null);
              setAssetFormData({ name: '', description: '', category: 'Hardware', currentlyWith: 'Office', status: 'Available', updateNotes: '' });
              setIsAssetModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
          >
            <Plus size={16} /> Add Asset
          </button>
        ) : (
          <button
            onClick={() => {
              setEditingContact(null);
              setContactFormData({ name: '', role: '', phone: '', email: '', notes: '' });
              setIsContactModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
          >
            <Plus size={16} /> Add Contact
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-bg-border)] gap-8">
        <button
          onClick={() => { setActiveTab('assets'); setSearch(''); }}
          className={`pb-3 font-black text-xs tracking-widest uppercase flex items-center gap-2 border-b-2 transition-all ${activeTab === 'assets' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
        >
          <Building2 size={16} /> Office Assets ({assets.length})
        </button>
        <button
          onClick={() => { setActiveTab('contacts'); setSearch(''); }}
          className={`pb-3 font-black text-xs tracking-widest uppercase flex items-center gap-2 border-b-2 transition-all ${activeTab === 'contacts' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
        >
          <Contact size={16} /> Important Contacts ({contacts.length})
        </button>
      </div>

      <div className="bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl p-4">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder={activeTab === 'assets' ? "SEARCH ASSETS OR USERS..." : "SEARCH CONTACTS BY NAME OR ROLE..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold tracking-widest uppercase text-[var(--color-text-primary)] focus:border-blue-500 transition-colors"
          />
        </div>

        {activeTab === 'assets' ? (
          assetsLoading ? (
            <div className="text-center py-8 text-[var(--color-text-secondary)] font-bold tracking-widest uppercase text-sm">Loading Assets...</div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-text-secondary)] font-bold tracking-widest uppercase text-xs">No assets found</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssets.map(asset => (
                <div key={asset._id} className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl p-4 hover:border-blue-500/30 transition-all flex flex-col h-full shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-[var(--color-text-primary)] uppercase tracking-tight">{asset.name}</h3>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingAsset(asset); setAssetFormData({ ...asset, updateNotes: '' }); setIsAssetModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-500/10 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => { if(confirm('Delete asset?')) deleteAssetMutation.mutate(asset._id); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-4 flex-1">{asset.description}</p>
                  
                  <div className="space-y-2 text-xs font-bold tracking-widest uppercase bg-[var(--color-bg-workspace)] p-3 rounded-xl border border-[var(--color-bg-border)]">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)] text-[10px]">Category:</span>
                      <span className="text-[var(--color-text-primary)]">{asset.category}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)] text-[10px]">Status:</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] ${asset.status === 'Available' ? 'bg-green-500/10 text-green-500' : asset.status === 'In Use' ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>{asset.status}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)] text-[10px]">With:</span>
                      <span className="text-blue-500">{asset.currentlyWith}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          contactsLoading ? (
            <div className="text-center py-8 text-[var(--color-text-secondary)] font-bold tracking-widest uppercase text-sm">Loading Contacts...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-text-secondary)] font-bold tracking-widest uppercase text-xs">No contacts found</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContacts.map(contact => (
                <div key={contact._id} className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl p-4 hover:border-blue-500/30 transition-all flex flex-col h-full shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-[var(--color-text-primary)] uppercase tracking-tight">{contact.name}</h3>
                      <p className="text-xs font-bold text-blue-500 tracking-widest uppercase">{contact.role}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingContact(contact); setContactFormData(contact); setIsContactModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-500/10 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => { if(confirm('Delete contact?')) deleteContactMutation.mutate(contact._id); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-2.5 text-xs font-bold tracking-widest uppercase flex-1 bg-[var(--color-bg-workspace)] p-3 rounded-xl border border-[var(--color-bg-border)]">
                    <div className="flex items-center gap-2 text-[var(--color-text-primary)] hover:text-blue-500 transition-colors">
                      <Phone size={14} className="text-[var(--color-text-muted)]" /> <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-2 text-[var(--color-text-primary)] hover:text-blue-500 transition-colors">
                        <Mail size={14} className="text-[var(--color-text-muted)]" /> <a href={`mailto:${contact.email}`}>{contact.email}</a>
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
          )
        )}
      </div>

      {/* Asset Modal */}
      <Modal isOpen={isAssetModalOpen} onClose={() => setIsAssetModalOpen(false)} title={editingAsset ? "Update Asset" : "New Asset"} showFooter={false}>
        <form onSubmit={handleAssetSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Asset Name</label>
            <input required type="text" value={assetFormData.name} onChange={e => setAssetFormData({...assetFormData, name: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Description</label>
            <input type="text" value={assetFormData.description} onChange={e => setAssetFormData({...assetFormData, description: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Category</label>
              <select value={assetFormData.category} onChange={e => setAssetFormData({...assetFormData, category: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500">
                <option>Hardware</option><option>Furniture</option><option>Software</option><option>Misc</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Status</label>
              <select value={assetFormData.status} onChange={e => setAssetFormData({...assetFormData, status: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500">
                <option>Available</option><option>In Use</option><option>Maintenance</option><option>Lost</option><option>Damaged</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Currently With</label>
            <select value={assetFormData.currentlyWith} onChange={e => setAssetFormData({...assetFormData, currentlyWith: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500">
              <option value="Office">Office (In Storage / Available)</option>
              {users.map(u => <option key={u._id} value={u.name}>{u.name} ({u.role})</option>)}
            </select>
          </div>
          {editingAsset && (
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Update Notes</label>
              <input type="text" placeholder="e.g., Handed over to John" value={assetFormData.updateNotes} onChange={e => setAssetFormData({...assetFormData, updateNotes: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-bg-border)]">
            <button type="button" onClick={() => setIsAssetModalOpen(false)} className="px-4 py-2 font-bold uppercase tracking-widest text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-border)] rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={saveAssetMutation.isPending} className="px-4 py-2 font-bold uppercase tracking-widest text-xs bg-blue-500 text-white hover:bg-blue-600 rounded-xl transition-colors shadow-md shadow-blue-500/20">
              {saveAssetMutation.isPending ? 'Saving...' : 'Save Asset'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Contact Modal */}
      <Modal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} title={editingContact ? "Update Contact" : "New Contact"} showFooter={false}>
        <form onSubmit={handleContactSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Name</label>
            <input required type="text" value={contactFormData.name} onChange={e => setContactFormData({...contactFormData, name: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Role / Position</label>
            <input required type="text" value={contactFormData.role} onChange={e => setContactFormData({...contactFormData, role: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Phone</label>
              <input required type="text" value={contactFormData.phone} onChange={e => setContactFormData({...contactFormData, phone: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Email (Optional)</label>
              <input type="email" value={contactFormData.email} onChange={e => setContactFormData({...contactFormData, email: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Notes</label>
            <textarea value={contactFormData.notes} onChange={e => setContactFormData({...contactFormData, notes: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm min-h-[80px] outline-none focus:border-blue-500" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-bg-border)]">
            <button type="button" onClick={() => setIsContactModalOpen(false)} className="px-4 py-2 font-bold uppercase tracking-widest text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-border)] rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={saveContactMutation.isPending} className="px-4 py-2 font-bold uppercase tracking-widest text-xs bg-blue-500 text-white hover:bg-blue-600 rounded-xl transition-colors shadow-md shadow-blue-500/20">
              {saveContactMutation.isPending ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default OfficeAssetsPage;
