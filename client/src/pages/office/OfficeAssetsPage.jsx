import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Building2, Plus, Contact, Phone, Mail, FileText, Database, Shield, RefreshCw } from 'lucide-react';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import {
  Button,
  Input,
  Badge,
  NexusModal,
  TabSwitcher,
  PageContainer,
  PageHeader,
  SearchInput,
  EmptyState,
  LoadingState,
  SectionCard,
} from '../../components/ui';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';

const OfficeAssetsPage = () => {
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState('assets'); // 'assets' or 'contacts'
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  
  const [assetFormData, setAssetFormData] = useState({ name: '', description: '', category: 'Hardware', currentlyWith: 'Office', status: 'Available', updateNotes: '', serialNumber: '', purchaseDate: '' });
  const [assetFormBaseline, setAssetFormBaseline] = useState(null);
  const [contactFormData, setContactFormData] = useState({ name: '', role: '', phone: '', email: '', notes: '' });
  const [contactFormBaseline, setContactFormBaseline] = useState(null);
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
    if (editingAsset) return;
    saveAssetMutation.mutate(assetFormData);
  };

  const handleContactSubmit = (e) => {
    if (e) e.preventDefault();
    if (editingContact) return;
    saveContactMutation.mutate(contactFormData);
  };

  const hasOfficeAssetEdits =
    isAssetModalOpen && editingAsset && assetFormBaseline && !stableJsonEqual(assetFormData, assetFormBaseline);

  const hasOfficeContactEdits =
    isContactModalOpen && editingContact && contactFormBaseline && !stableJsonEqual(contactFormData, contactFormBaseline);

  useUnsavedChanges({
    hasChanges: hasOfficeAssetEdits,
    onSave: () => handleAssetSubmit(),
    onCancel: () => assetFormBaseline && setAssetFormData(cloneSnapshot(assetFormBaseline)),
    isSaving: saveAssetMutation.isPending,
    elevated: true,
  });

  useUnsavedChanges({
    hasChanges: hasOfficeContactEdits,
    onSave: () => handleContactSubmit(),
    onCancel: () => contactFormBaseline && setContactFormData(cloneSnapshot(contactFormBaseline)),
    isSaving: saveContactMutation.isPending,
    elevated: true,
  });

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'Available': return 'success';
      case 'In Use': return 'warning';
      default: return 'danger';
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
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        icon={Building2}
        title="Office & Contacts Registry"
        subtitle="Manage office assets and important personnel"
        actions={
          activeTab === 'assets' ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingAsset(null);
                setAssetFormBaseline(null);
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
                setContactFormBaseline(null);
                setContactFormData({ name: '', role: '', phone: '', email: '', notes: '' });
                setIsContactModalOpen(true);
              }}
            >
              <Plus size={14} /> Add Contact
            </Button>
          )
        }
      >
        <TabSwitcher
          tabs={[
            { id: 'assets', label: `Office Assets (${assets.length})` },
            { id: 'contacts', label: `Important Contacts (${contacts.length})` }
          ]}
          activeTab={activeTab}
          onChange={(tabId) => { setActiveTab(tabId); setSearch(''); }}
          className="mt-2"
        />
      </PageHeader>

      <SectionCard noPadding bodyClassName="p-4">
        <SearchInput
          placeholder={activeTab === 'assets' ? 'Search assets or users...' : 'Search contacts by name or role...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4"
        />

        {activeTab === 'assets' ? (
          assetsLoading ? (
            <LoadingState message="Loading assets..." className="!py-8" />
          ) : filteredAssets.length === 0 ? (
            <EmptyState variant="subtle" title="No assets found" />
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
                        const loaded = { ...asset, purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '', updateNotes: '' };
                        setEditingAsset(asset);
                        setAssetFormData(loaded);
                        setAssetFormBaseline(cloneSnapshot(loaded));
                        setIsAssetModalOpen(true);
                      }}
                      className="cursor-pointer hover:bg-[var(--color-bg-secondary)]/60 transition-colors"
                    >
                      <td className="px-4 py-2 text-xs font-black text-[var(--color-text-primary)] uppercase">{asset.name}</td>
                      <td className="px-4 py-2 text-[10px] font-black uppercase text-[var(--color-text-secondary)]">{asset.category}</td>
                      <td className="px-4 py-2">
                        <Badge variant={getStatusBadgeVariant(asset.status)}>{asset.status}</Badge>
                      </td>
                      <td className="px-4 py-2 text-xs font-bold text-[var(--color-action-primary)]">{asset.currentlyWith}</td>
                      <td className="px-4 py-2 text-[10px] font-mono text-[var(--color-text-muted)] uppercase">{asset.serialNumber || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          contactsLoading ? (
            <LoadingState message="Loading contacts..." className="!py-8" />
          ) : filteredContacts.length === 0 ? (
            <EmptyState variant="subtle" title="No contacts found" />
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
                        const loaded = { name: contact.name, role: contact.role, phone: contact.phone, email: contact.email || '', notes: contact.notes || '' };
                        setEditingContact(contact);
                        setContactFormData(loaded);
                        setContactFormBaseline(cloneSnapshot(loaded));
                        setIsContactModalOpen(true);
                      }}
                      className="cursor-pointer hover:bg-[var(--color-bg-secondary)]/60 transition-colors"
                    >
                      <td className="px-4 py-2 text-xs font-black text-[var(--color-text-primary)] uppercase">{contact.name}</td>
                      <td className="px-4 py-2 text-[10px] font-black uppercase text-[var(--color-action-primary)]">{contact.role}</td>
                      <td className="px-4 py-2 text-[10px] font-bold text-[var(--color-text-secondary)]">{contact.phone}</td>
                      <td className="px-4 py-2 text-[10px] text-[var(--color-text-muted)]">{contact.email || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </SectionCard>

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
              <label className="block text-[10px] font-black tracking-widest uppercase text-[var(--color-text-muted)] mb-1 ml-1">Description</label>
              <textarea 
                value={assetFormData.description} 
                onChange={e => setAssetFormData({...assetFormData, description: e.target.value})} 
                className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-4 py-2 text-xs font-bold outline-none text-[var(--color-text-primary)] focus:border-blue-500 transition-colors min-h-[100px]" 
                placeholder="Describe the asset..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black tracking-widest uppercase text-[var(--color-text-muted)] mb-1 ml-1">Category</label>
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
                <label className="block text-[10px] font-black tracking-widest uppercase text-[var(--color-text-muted)] mb-1 ml-1">Status</label>
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
              <label className="block text-[10px] font-black tracking-widest uppercase text-[var(--color-text-muted)] mb-1 ml-1">Currently With</label>
              <select 
                value={assetFormData.currentlyWith} 
                onChange={e => setAssetFormData({...assetFormData, currentlyWith: e.target.value})} 
                className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-xs font-bold outline-none text-[var(--color-text-primary)] focus:border-blue-500"
              >
                <option value="Office">Office (In Storage / Available)</option>
                {users.map(u => <option key={u._id} value={u.name}>{u.name} ({u.departmentId?.name || 'Unassigned'})</option>)}
              </select>
            </div>
          </div>

          {/* Right 30% Metadata & Action Panel */}
          <div className="md:col-span-3 border-t md:border-t-0 md:border-l border-[var(--color-bg-border)] pt-6 md:pt-0 md:pl-6 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-2">Metadata & Actions</h3>
            
            <Input 
              label="Serial Number (S/N)" 
              placeholder="e.g. SN-12345" 
              value={assetFormData.serialNumber || ''} 
              onChange={e => setAssetFormData({...assetFormData, serialNumber: e.target.value})} 
              icon={Database}
            />

            <div>
              <label className="block text-[10px] font-black tracking-widest uppercase text-[var(--color-text-muted)] mb-1 ml-1">Purchase Date</label>
              <input 
                type="date" 
                value={assetFormData.purchaseDate || ''} 
                onChange={e => setAssetFormData({...assetFormData, purchaseDate: e.target.value})} 
                className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-4 py-2 text-xs font-bold outline-none text-[var(--color-text-primary)] focus:border-blue-500" 
                placeholder="Purchase Date"
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
              {!editingAsset && (
                <Button type="submit" className="w-full" disabled={saveAssetMutation.isPending}>
                  {saveAssetMutation.isPending ? <RefreshCw className="animate-spin" size={14} /> : 'Add Asset'}
                </Button>
              )}
              {editingAsset && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full !text-rose-500 hover:!bg-rose-500/10" 
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete asset?',
                      message: 'Delete asset permanently?',
                      confirmLabel: 'Delete',
                      type: 'danger',
                    });
                    if (ok) deleteAssetMutation.mutate(editingAsset._id);
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
              <label className="block text-[10px] font-black tracking-widest uppercase text-[var(--color-text-muted)] mb-1 ml-1">Internal Remarks / Notes</label>
              <textarea 
                value={contactFormData.notes} 
                onChange={e => setContactFormData({...contactFormData, notes: e.target.value})} 
                className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-4 py-2 text-xs font-bold outline-none text-[var(--color-text-primary)] focus:border-blue-500 transition-colors min-h-[120px]" 
                placeholder="Add special notes..."
              />
            </div>
          </div>

          {/* Right 30% Metadata & Action Panel */}
          <div className="md:col-span-3 border-t md:border-t-0 md:border-l border-[var(--color-bg-border)] pt-6 md:pt-0 md:pl-6 space-y-4">
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
              {!editingContact && (
                <Button type="submit" className="w-full" disabled={saveContactMutation.isPending}>
                  {saveContactMutation.isPending ? <RefreshCw className="animate-spin" size={14} /> : 'Add Contact'}
                </Button>
              )}
              {editingContact && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full !text-rose-500 hover:!bg-rose-500/10" 
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete contact?',
                      message: 'Delete contact permanently?',
                      confirmLabel: 'Delete',
                      type: 'danger',
                    });
                    if (ok) deleteContactMutation.mutate(editingContact._id);
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
    </PageContainer>
  );
};

export default OfficeAssetsPage;


// Performance Optimization: useCallback(eventHandler) memoization guard
