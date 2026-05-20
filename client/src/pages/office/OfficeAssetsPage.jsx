import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Building2, Plus, Search, Contact, Phone, Mail, FileText, Database, Shield, RefreshCw } from 'lucide-react';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { Button, Input, Badge, NexusModal } from '../../components/ui';

const OfficeAssetsPage = () => {
  const [activeTab, setActiveTab] = useState('assets'); // 'assets' or 'contacts'
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  
  const [assetFormData, setAssetFormData] = useState({ name: '', description: '', category: 'Hardware', currentlyWith: 'Office', status: 'Available', updateNotes: '', serialNumber: '', purchaseDate: '' });
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

  // Esc key binding for instant closure
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsAssetModalOpen(false);
        setIsContactModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      setAssetFormData({ name: '', description: '', category: 'Hardware', currentlyWith: 'Office', status: 'Available', updateNotes: '', serialNumber: '', purchaseDate: '' });
    }
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (id) => await axios.delete(`/api/office-assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['office-assets']);
      setIsAssetModalOpen(false);
      setEditingAsset(null);
    }
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
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      setIsContactModalOpen(false);
      setEditingContact(null);
    }
  });

  const handleAssetSubmit = (e) => {
    if (e) e.preventDefault();
    saveAssetMutation.mutate(assetFormData);
  };

  const handleContactSubmit = (e) => {
    if (e) e.preventDefault();
    saveContactMutation.mutate(contactFormData);
  };

  const getStatusColorClass = (status) => {
    switch (status) {
      case 'Available':
        return 'bg-[#E6F4EA] text-[#137333] dark:bg-[#0F2916] dark:text-[#81C995]';
      case 'In Use':
        return 'bg-[#FEF7E0] text-[#B06000] dark:bg-[#2E2003] dark:text-[#FDD663]';
      default:
        return 'bg-[#FCE8E6] text-[#C5221F] dark:bg-[#30100F] dark:text-[#F28B82]';
    }
  };

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    a.currentlyWith.toLowerCase().includes(search.toLowerCase())
  );

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-[var(--color-text-primary)] flex items-center gap-3">
            <Building2 className="text-blue-500" />
            Office & Contacts Registry
          </h1>
          <p className="text-[var(--color-text-muted)] text-[10px] font-black tracking-widest uppercase mt-1">Manage office assets and important personnel</p>
        </div>
        
        {activeTab === 'assets' ? (
          <Button
            size="sm"
            onClick={() => {
              setEditingAsset(null);
              setAssetFormData({ name: '', description: '', category: 'Hardware', currentlyWith: 'Office', status: 'Available', updateNotes: '', serialNumber: '', purchaseDate: '' });
              setIsAssetModalOpen(true);
            }}
          >
            <Plus size={14} /> Add Asset
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              setEditingContact(null);
              setContactFormData({ name: '', role: '', phone: '', email: '', notes: '' });
              setIsContactModalOpen(true);
            }}
          >
            <Plus size={14} /> Add Contact
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-bg-border)] gap-6">
        <button
          onClick={() => { setActiveTab('assets'); setSearch(''); }}
          className={`pb-2 font-black text-[10px] tracking-widest uppercase flex items-center gap-2 border-b-2 transition-all ${activeTab === 'assets' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
        >
          <Building2 size={14} /> Office Assets ({assets.length})
        </button>
        <button
          onClick={() => { setActiveTab('contacts'); setSearch(''); }}
          className={`pb-2 font-black text-[10px] tracking-widest uppercase flex items-center gap-2 border-b-2 transition-all ${activeTab === 'contacts' ? 'border-blue-500 text-blue-500' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
        >
          <Contact size={14} /> Important Contacts ({contacts.length})
        </button>
      </div>

      <div className="bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder={activeTab === 'assets' ? "SEARCH ASSETS OR USERS..." : "SEARCH CONTACTS BY NAME OR ROLE..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl pl-9 pr-4 py-2 text-xs font-bold tracking-widest uppercase text-[var(--color-text-primary)] focus:border-blue-500 outline-none transition-colors"
          />
        </div>

        {activeTab === 'assets' ? (
          assetsLoading ? (
            <div className="text-center py-8 text-[var(--color-text-secondary)] font-bold tracking-widest uppercase text-xs">Loading Assets...</div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-text-secondary)] font-bold tracking-widest uppercase text-xs">No assets found</div>
          ) : (
            <div className="overflow-x-auto border border-[var(--color-bg-border)] rounded-2xl bg-[var(--color-bg-surface)]">
              <table className="w-full text-left">
                <thead className="bg-[var(--color-bg-workspace)]/50 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] border-b border-[var(--color-bg-border)]">
                  <tr>
                    <th className="px-4 py-2">Asset Name</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Currently With</th>
                    <th className="px-4 py-2">Serial Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-border)]">
                  {filteredAssets.map(asset => (
                    <tr 
                      key={asset._id} 
                      onClick={() => {
                        setEditingAsset(asset);
                        setAssetFormData({ ...asset, purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '', updateNotes: '' });
                        setIsAssetModalOpen(true);
                      }}
                      className="cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-2 text-xs font-black text-[var(--color-text-primary)] uppercase">{asset.name}</td>
                      <td className="px-4 py-2 text-[10px] font-black uppercase text-[var(--color-text-secondary)]">{asset.category}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${getStatusColorClass(asset.status)}`}>
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs font-bold text-blue-500">{asset.currentlyWith}</td>
                      <td className="px-4 py-2 text-[10px] font-mono text-[var(--color-text-muted)] uppercase">{asset.serialNumber || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          contactsLoading ? (
            <div className="text-center py-8 text-[var(--color-text-secondary)] font-bold tracking-widest uppercase text-xs">Loading Contacts...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-text-secondary)] font-bold tracking-widest uppercase text-xs">No contacts found</div>
          ) : (
            <div className="overflow-x-auto border border-[var(--color-bg-border)] rounded-2xl bg-[var(--color-bg-surface)]">
              <table className="w-full text-left">
                <thead className="bg-[var(--color-bg-workspace)]/50 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] border-b border-[var(--color-bg-border)]">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Role / Position</th>
                    <th className="px-4 py-2">Phone</th>
                    <th className="px-4 py-2">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-border)]">
                  {filteredContacts.map(contact => (
                    <tr 
                      key={contact._id} 
                      onClick={() => {
                        setEditingContact(contact);
                        setContactFormData(contact);
                        setIsContactModalOpen(true);
                      }}
                      className="cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-2 text-xs font-black text-[var(--color-text-primary)] uppercase">{contact.name}</td>
                      <td className="px-4 py-2 text-[10px] font-black uppercase text-blue-500">{contact.role}</td>
                      <td className="px-4 py-2 text-[10px] font-bold text-[var(--color-text-secondary)]">{contact.phone}</td>
                      <td className="px-4 py-2 text-[10px] text-[var(--color-text-muted)]">{contact.email || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Immersive Asset Workspace Drawer Modal (70-30 split layout) */}
      <NexusModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        title={editingAsset ? `Asset Workspace: ${assetFormData.name}` : "Create New Asset"}
        showFooter={false}
        width="max-w-4xl"
      >
        <form onSubmit={handleAssetSubmit} className="grid grid-cols-1 md:grid-cols-10 gap-6 p-2">
          {/* Left 70% Primary Data Fields */}
          <div className="md:col-span-7 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Primary Fields</h3>
            
            <Input 
              label="Asset Name" 
              value={assetFormData.name} 
              onChange={e => setAssetFormData({...assetFormData, name: e.target.value})} 
              icon={Building2}
              required 
            />

            <div>
              <label className="block text-[9px] font-black tracking-widest uppercase text-[var(--color-text-muted)] mb-1.5 ml-1">Description</label>
              <textarea 
                value={assetFormData.description} 
                onChange={e => setAssetFormData({...assetFormData, description: e.target.value})} 
                className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-4 py-2 text-xs font-bold outline-none text-[var(--color-text-primary)] focus:border-blue-500 transition-colors min-h-[100px]" 
                placeholder="Describe the asset..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-black tracking-widest uppercase text-[var(--color-text-muted)] mb-1.5 ml-1">Category</label>
                <select 
                  value={assetFormData.category} 
                  onChange={e => setAssetFormData({...assetFormData, category: e.target.value})} 
                  className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-xs font-bold outline-none text-[var(--color-text-primary)] focus:border-blue-500"
                >
                  <option>Hardware</option>
                  <option>Furniture</option>
                  <option>Software</option>
                  <option>Misc</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black tracking-widest uppercase text-[var(--color-text-muted)] mb-1.5 ml-1">Status</label>
                <select 
                  value={assetFormData.status} 
                  onChange={e => setAssetFormData({...assetFormData, status: e.target.value})} 
                  className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-xs font-bold outline-none text-[var(--color-text-primary)] focus:border-blue-500"
                >
                  <option>Available</option>
                  <option>In Use</option>
                  <option>Maintenance</option>
                  <option>Lost</option>
                  <option>Damaged</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black tracking-widest uppercase text-[var(--color-text-muted)] mb-1.5 ml-1">Currently With</label>
              <select 
                value={assetFormData.currentlyWith} 
                onChange={e => setAssetFormData({...assetFormData, currentlyWith: e.target.value})} 
                className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-xs font-bold outline-none text-[var(--color-text-primary)] focus:border-blue-500"
              >
                <option value="Office">Office (In Storage / Available)</option>
                {users.map(u => <option key={u._id} value={u.name}>{u.name} ({u.role})</option>)}
              </select>
            </div>
          </div>

          {/* Right 30% Metadata & Action Panel */}
          <div className="md:col-span-3 border-l border-[var(--color-bg-border)] pl-6 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-2">Metadata & Actions</h3>
            
            <Input 
              label="Serial Number (S/N)" 
              placeholder="e.g. SN-12345" 
              value={assetFormData.serialNumber || ''} 
              onChange={e => setAssetFormData({...assetFormData, serialNumber: e.target.value})} 
              icon={Database}
            />

            <div>
              <label className="block text-[9px] font-black tracking-widest uppercase text-[var(--color-text-muted)] mb-1.5 ml-1">Purchase Date</label>
              <input 
                type="date" 
                value={assetFormData.purchaseDate || ''} 
                onChange={e => setAssetFormData({...assetFormData, purchaseDate: e.target.value})} 
                className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-4 py-2 text-xs font-bold outline-none text-[var(--color-text-primary)] focus:border-blue-500" 
              />
            </div>

            {editingAsset && (
              <Input 
                label="Update Remark / Notes" 
                placeholder="e.g., Handed to John" 
                value={assetFormData.updateNotes || ''} 
                onChange={e => setAssetFormData({...assetFormData, updateNotes: e.target.value})} 
                icon={FileText}
              />
            )}

            <div className="pt-4 border-t border-[var(--color-bg-border)] space-y-2">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={saveAssetMutation.isPending}
              >
                {saveAssetMutation.isPending ? <RefreshCw className="animate-spin" size={14} /> : 'Save Asset'}
              </Button>
              
              {editingAsset && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full !text-rose-500 hover:!bg-rose-500/10" 
                  onClick={() => {
                    if (confirm('Delete asset permanently?')) {
                      deleteAssetMutation.mutate(editingAsset._id);
                    }
                  }}
                >
                  Delete Asset
                </Button>
              )}
              
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full text-[var(--color-text-secondary)]" 
                onClick={() => setIsAssetModalOpen(false)}
              >
                Close (Esc)
              </Button>
            </div>
          </div>
        </form>
      </NexusModal>

      {/* Immersive Contact Workspace Drawer Modal (70-30 split layout) */}
      <NexusModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        title={editingContact ? `Contact Workspace: ${contactFormData.name}` : "Create New Contact"}
        showFooter={false}
        width="max-w-4xl"
      >
        <form onSubmit={handleContactSubmit} className="grid grid-cols-1 md:grid-cols-10 gap-6 p-2">
          {/* Left 70% Primary Data Fields */}
          <div className="md:col-span-7 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Primary Fields</h3>
            
            <Input 
              label="Contact Name" 
              value={contactFormData.name} 
              onChange={e => setContactFormData({...contactFormData, name: e.target.value})} 
              icon={Contact}
              required 
            />

            <Input 
              label="Role / Position" 
              value={contactFormData.role} 
              onChange={e => setContactFormData({...contactFormData, role: e.target.value})} 
              icon={Shield}
              required 
            />

            <div>
              <label className="block text-[9px] font-black tracking-widest uppercase text-[var(--color-text-muted)] mb-1.5 ml-1">Internal Remarks / Notes</label>
              <textarea 
                value={contactFormData.notes} 
                onChange={e => setContactFormData({...contactFormData, notes: e.target.value})} 
                className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-4 py-2 text-xs font-bold outline-none text-[var(--color-text-primary)] focus:border-blue-500 transition-colors min-h-[120px]" 
                placeholder="Add special notes..."
              />
            </div>
          </div>

          {/* Right 30% Metadata & Action Panel */}
          <div className="md:col-span-3 border-l border-[var(--color-bg-border)] pl-6 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-2">Details & Actions</h3>
            
            <Input 
              label="Phone Number" 
              value={contactFormData.phone} 
              onChange={e => setContactFormData({...contactFormData, phone: e.target.value})} 
              icon={Phone}
              required 
            />

            <Input 
              label="Email Address" 
              type="email"
              value={contactFormData.email || ''} 
              onChange={e => setContactFormData({...contactFormData, email: e.target.value})} 
              icon={Mail}
            />

            <div className="pt-4 border-t border-[var(--color-bg-border)] space-y-2">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={saveContactMutation.isPending}
              >
                {saveContactMutation.isPending ? <RefreshCw className="animate-spin" size={14} /> : 'Save Contact'}
              </Button>
              
              {editingContact && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full !text-rose-500 hover:!bg-rose-500/10" 
                  onClick={() => {
                    if (confirm('Delete contact permanently?')) {
                      deleteContactMutation.mutate(editingContact._id);
                    }
                  }}
                >
                  Delete Contact
                </Button>
              )}
              
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full text-[var(--color-text-secondary)]" 
                onClick={() => setIsContactModalOpen(false)}
              >
                Close (Esc)
              </Button>
            </div>
          </div>
        </form>
      </NexusModal>
    </div>
  );
};

export default OfficeAssetsPage;
