import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Wrench, Plus, Search } from 'lucide-react';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { PageContainer, PageHeader, Card, Button, Input, NexusModal, PageSkeleton, DataLoading } from '../../components/ui';
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';

const ASSET_CATEGORIES = ['Hardware', 'Furniture', 'Software', 'Misc'];
const ASSET_STATUSES = ['Available', 'In Use', 'Maintenance', 'Lost', 'Damaged'];

const EMPTY_ASSET_FORM = {
  name: '',
  description: '',
  category: 'Hardware',
  currentlyWith: 'Office',
  status: 'Available',
  updateNotes: '',
  serialNumber: '',
  purchaseDate: '',
};

const toAssetFormData = (asset) => ({
  name: asset.name || '',
  description: asset.description || '',
  category: ASSET_CATEGORIES.includes(asset.category) ? asset.category : 'Hardware',
  currentlyWith: asset.currentlyWith || 'Office',
  status: ASSET_STATUSES.includes(asset.status) ? asset.status : 'Available',
  updateNotes: '',
  serialNumber: asset.serialNumber || '',
  purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().slice(0, 10) : '',
});

const EquipmentPage = () => {
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [search, setSearch] = useState('');
  const [assetFormData, setAssetFormData] = useState(EMPTY_ASSET_FORM);
  const [assetFormBaseline, setAssetFormBaseline] = useState(EMPTY_ASSET_FORM);
  const queryClient = useQueryClient();
  const { data: users = [] } = useUserDirectory();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['office-assets'],
    queryFn: async () => (await axios.get('/api/office-assets')).data
  });

  const saveAssetMutation = useMutation({
    mutationFn: async (data) => editingAsset ? axios.put(`/api/office-assets/${editingAsset._id}`, data) : axios.post('/api/office-assets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-assets'] });
      setIsAssetModalOpen(false);
      setEditingAsset(null);
      setAssetFormData(EMPTY_ASSET_FORM);
    }
  });

  const hasEquipmentEdits =
    isAssetModalOpen &&
    editingAsset &&
    !stableJsonEqual(assetFormData, assetFormBaseline);

  useUnsavedChanges({
    hasChanges: hasEquipmentEdits,
    onSave: () => saveAssetMutation.mutate(assetFormData),
    onCancel: () => setAssetFormData(cloneSnapshot(assetFormBaseline)),
    isSaving: saveAssetMutation.isPending,
    elevated: true,
  });

  const filteredAssets = assets.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) || a.currentlyWith.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading && !assets.length) {
    return <PageContainer className="!py-4"><PageSkeleton /></PageContainer>;
  }

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader title="Equipment" subtitle="Manage office equipment and assignment." icon={Wrench} actions={<Button size="sm" onClick={() => { setEditingAsset(null); setAssetFormData(EMPTY_ASSET_FORM); setAssetFormBaseline(EMPTY_ASSET_FORM); setIsAssetModalOpen(true); }}><Plus size={14} /> Add Asset</Button>} />
      <Card className="p-4 space-y-4">
        <Input placeholder="Search equipment..." value={search} onChange={(e) => setSearch(e.target.value)} icon={Search} />
        <div className="overflow-x-auto border border-[var(--color-bg-border)] rounded-xl">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Currently With</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={4}><DataLoading /></td></tr>}
              {!isLoading && filteredAssets.map((asset) => (
                <tr key={asset._id} className="border-t border-[var(--color-bg-border)] cursor-pointer" onClick={() => { const loaded = toAssetFormData(asset); setEditingAsset(asset); setAssetFormData(loaded); setAssetFormBaseline(cloneSnapshot(loaded)); setIsAssetModalOpen(true); }}>
                  <td className="px-3 py-2 font-bold">{asset.name}</td>
                  <td className="px-3 py-2">{asset.category}</td>
                  <td className="px-3 py-2">{asset.status}</td>
                  <td className="px-3 py-2">{asset.currentlyWith}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <NexusModal isOpen={isAssetModalOpen} onClose={() => setIsAssetModalOpen(false)} title={editingAsset ? 'Edit Equipment' : 'Add Equipment'} showFooter={false} width="max-w-3xl">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!editingAsset) saveAssetMutation.mutate(assetFormData); }}>
          <Input label="Name" value={assetFormData.name} onChange={(e) => setAssetFormData({ ...assetFormData, name: e.target.value })} icon={Wrench} required />
          <Input label="Description" value={assetFormData.description} onChange={(e) => setAssetFormData({ ...assetFormData, description: e.target.value })} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1">Category</label>
              <select
                className="w-full border rounded-lg p-2 bg-transparent"
                value={assetFormData.category}
                onChange={(e) => setAssetFormData({ ...assetFormData, category: e.target.value })}
              >
                {ASSET_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Status</label>
              <select
                className="w-full border rounded-lg p-2 bg-transparent"
                value={assetFormData.status}
                onChange={(e) => setAssetFormData({ ...assetFormData, status: e.target.value })}
              >
                {ASSET_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1">Currently With</label>
            <select className="w-full border rounded-lg p-2 bg-transparent" value={assetFormData.currentlyWith} onChange={(e) => setAssetFormData({ ...assetFormData, currentlyWith: e.target.value })}>
              <option value="Office">Office</option>
              {users.map((u) => <option key={u._id} value={u.name}>{u.name}</option>)}
            </select>
          </div>
          {!editingAsset && (
            <Button type="submit" disabled={saveAssetMutation.isPending}>{saveAssetMutation.isPending ? 'Saving...' : 'Add Asset'}</Button>
          )}
        </form>
      </NexusModal>
    </PageContainer>
  );
};

export default EquipmentPage;
