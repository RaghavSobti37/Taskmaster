import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Wrench, Plus, Search } from 'lucide-react';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { PageContainer, PageHeader, Card, Button, Input, NexusModal, PageSkeleton, DataLoading } from '../../components/ui';

const EquipmentPage = () => {
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [search, setSearch] = useState('');
  const [assetFormData, setAssetFormData] = useState({ name: '', description: '', category: 'Hardware', currentlyWith: 'Office', status: 'Available', updateNotes: '', serialNumber: '', purchaseDate: '' });
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
      setAssetFormData({ name: '', description: '', category: 'Hardware', currentlyWith: 'Office', status: 'Available', updateNotes: '', serialNumber: '', purchaseDate: '' });
    }
  });

  const filteredAssets = assets.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) || a.currentlyWith.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading && !assets.length) {
    return <PageContainer className="!py-4"><PageSkeleton /></PageContainer>;
  }

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader title="Equipment" subtitle="Manage office equipment and assignment." icon={Wrench} actions={<Button size="sm" onClick={() => setIsAssetModalOpen(true)}><Plus size={14} /> Add Asset</Button>} />
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
                <tr key={asset._id} className="border-t border-[var(--color-bg-border)] cursor-pointer" onClick={() => { setEditingAsset(asset); setAssetFormData({ ...asset, purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().slice(0, 10) : '' }); setIsAssetModalOpen(true); }}>
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
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveAssetMutation.mutate(assetFormData); }}>
          <Input label="Name" value={assetFormData.name} onChange={(e) => setAssetFormData({ ...assetFormData, name: e.target.value })} icon={Wrench} />
          <Input label="Description" value={assetFormData.description} onChange={(e) => setAssetFormData({ ...assetFormData, description: e.target.value })} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Category" value={assetFormData.category} onChange={(e) => setAssetFormData({ ...assetFormData, category: e.target.value })} />
            <Input label="Status" value={assetFormData.status} onChange={(e) => setAssetFormData({ ...assetFormData, status: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs mb-1">Currently With</label>
            <select className="w-full border rounded-lg p-2 bg-transparent" value={assetFormData.currentlyWith} onChange={(e) => setAssetFormData({ ...assetFormData, currentlyWith: e.target.value })}>
              <option value="Office">Office</option>
              {users.map((u) => <option key={u._id} value={u.name}>{u.name}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={saveAssetMutation.isPending}>{saveAssetMutation.isPending ? 'Saving...' : 'Save'}</Button>
        </form>
      </NexusModal>
    </PageContainer>
  );
};

export default EquipmentPage;
