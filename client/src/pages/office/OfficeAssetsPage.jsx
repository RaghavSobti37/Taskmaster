import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Building2, Plus, Edit2, Trash2, Search } from 'lucide-react';
import { Modal } from '../../components/ui';

const OfficeAssetsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', category: 'Hardware', currentlyWith: 'Office', status: 'Available', updateNotes: '' });
  const [search, setSearch] = useState('');
  
  const queryClient = useQueryClient();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['office-assets'],
    queryFn: async () => (await axios.get('/api/office-assets')).data
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingAsset) {
        return await axios.put(`/api/office-assets/${editingAsset._id}`, data);
      }
      return await axios.post('/api/office-assets', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['office-assets']);
      setIsModalOpen(false);
      setEditingAsset(null);
      setFormData({ name: '', description: '', category: 'Hardware', currentlyWith: 'Office', status: 'Available', updateNotes: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => await axios.delete(`/api/office-assets/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['office-assets'])
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const filteredAssets = assets.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.currentlyWith.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--color-text-primary)] flex items-center gap-3">
            <Building2 className="text-blue-500" />
            Office Assets
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm font-bold tracking-widest uppercase mt-1">Track hardware and office items</p>
        </div>
        <button
          onClick={() => {
            setEditingAsset(null);
            setFormData({ name: '', description: '', category: 'Hardware', currentlyWith: 'Office', status: 'Available', updateNotes: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-blue-600 transition-colors"
        >
          <Plus size={16} /> Add Asset
        </button>
      </div>

      <div className="bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl p-4">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="SEARCH ASSETS OR USERS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold tracking-widest uppercase text-[var(--color-text-primary)] focus:border-blue-500 transition-colors"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-[var(--color-text-secondary)] font-bold tracking-widest uppercase text-sm">Loading Assets...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAssets.map(asset => (
              <div key={asset._id} className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl p-4 hover:border-blue-500/30 transition-all flex flex-col h-full">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-[var(--color-text-primary)] uppercase tracking-tight">{asset.name}</h3>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingAsset(asset); setFormData({ ...asset, updateNotes: '' }); setIsModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-500/10">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => { if(confirm('Delete asset?')) deleteMutation.mutate(asset._id); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-500/10">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mb-4 flex-1">{asset.description}</p>
                
                <div className="space-y-2 text-xs font-bold tracking-widest uppercase">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Category:</span>
                    <span className="text-[var(--color-text-primary)]">{asset.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className={`px-2 py-0.5 rounded-full ${asset.status === 'Available' ? 'bg-green-500/10 text-green-500' : asset.status === 'In Use' ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>{asset.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">With:</span>
                    <span className="text-[var(--color-text-primary)]">{asset.currentlyWith}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAsset ? "Update Asset" : "New Asset"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Asset Name</label>
            <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold" />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Description</label>
            <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Category</label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold">
                <option>Hardware</option><option>Furniture</option><option>Software</option><option>Misc</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Status</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold">
                <option>Available</option><option>In Use</option><option>Maintenance</option><option>Lost</option><option>Damaged</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Currently With</label>
            <input type="text" value={formData.currentlyWith} onChange={e => setFormData({...formData, currentlyWith: e.target.value})} className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm font-bold" />
          </div>
          {editingAsset && (
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-1">Update Notes</label>
              <input type="text" placeholder="e.g., Handed over to John" value={formData.updateNotes} onChange={e => setFormData({...formData, updateNotes: e.target.value})} className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl px-3 py-2 text-sm" />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-bold uppercase tracking-widest text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-border)] rounded-xl">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="px-4 py-2 font-bold uppercase tracking-widest text-xs bg-blue-500 text-white hover:bg-blue-600 rounded-xl">
              {saveMutation.isPending ? 'Saving...' : 'Save Asset'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default OfficeAssetsPage;
