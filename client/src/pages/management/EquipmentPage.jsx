import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Wrench, Plus } from 'lucide-react';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import ListPageLayout from '../../components/ui/ListPageLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import SearchInput from '../../components/ui/SearchInput';
import { Button, Input, DataTable, Badge } from '../../components/ui/primitives';
import { NexusModal, ModalFooter } from '../../components/ui/modals';;
import { distributionFromField } from '../../utils/buildChartSeries';
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

const EQUIPMENT_FIELD_LABELS = {
  name: 'Name',
  description: 'Description',
  category: 'Category',
  status: 'Status',
  currentlyWith: 'Currently With',
  serialNumber: 'Serial Number',
  purchaseDate: 'Purchase Date',
};

const equipmentStatusVariant = (status) => {
  if (status === 'Available') return 'success';
  if (status === 'In Use') return 'info';
  if (status === 'Maintenance') return 'warning';
  return 'danger';
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
    queryFn: async () => (await axios.get('/api/office-assets')).data,
  });

  const saveAssetMutation = useMutation({
    mutationFn: async (data) =>
      editingAsset
        ? axios.put(`/api/office-assets/${editingAsset._id}`, data)
        : axios.post('/api/office-assets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-assets'] });
      setIsAssetModalOpen(false);
      setEditingAsset(null);
      setAssetFormData(EMPTY_ASSET_FORM);
    },
  });

  const hasEquipmentEdits =
    isAssetModalOpen && !!editingAsset && !stableJsonEqual(assetFormData, assetFormBaseline);

  const { revert: revertEquipmentEdits } = useUnsavedChanges({
    baseline: assetFormBaseline,
    draft: assetFormData,
    setDraft: setAssetFormData,
    hasChanges: hasEquipmentEdits,
    onSave: () => saveAssetMutation.mutate(assetFormData),
    enabled: false,
    isSaving: saveAssetMutation.isPending,
    fieldLabels: EQUIPMENT_FIELD_LABELS,
    excludeFields: ['updateNotes'],
  });

  const filteredAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.currentlyWith.toLowerCase().includes(search.toLowerCase()) ||
          (a.category || '').toLowerCase().includes(search.toLowerCase())
      ),
    [assets, search]
  );

  const openAssetEditor = (asset) => {
    const loaded = toAssetFormData(asset);
    setEditingAsset(asset);
    setAssetFormData(loaded);
    setAssetFormBaseline(cloneSnapshot(loaded));
    setIsAssetModalOpen(true);
  };

  const statusChart = useMemo(
    () => distributionFromField(assets, 'status'),
    [assets]
  );

  const categoryChart = useMemo(
    () => distributionFromField(assets, 'category'),
    [assets]
  );

  const equipmentColumns = useMemo(
    () => [
      {
        header: 'Equipment',
        sortKey: 'name',
        render: (row) => (
          <div className="min-w-0">
            <span className="tm-data-primary text-xs tracking-tight block truncate">{row.name}</span>
            {row.description ? (
              <span className="text-[10px] text-[var(--color-text-muted)] block truncate">{row.description}</span>
            ) : null}
          </div>
        ),
      },
      {
        header: 'Category',
        sortKey: 'category',
        render: (row) => <Badge variant="info">{row.category}</Badge>,
      },
      {
        header: 'Status',
        sortKey: 'status',
        render: (row) => <Badge variant={equipmentStatusVariant(row.status)}>{row.status}</Badge>,
      },
      {
        header: 'Assigned To',
        sortKey: 'currentlyWith',
        render: (row) => (
          <span className="text-[11px] font-bold text-[var(--color-text-primary)]">{row.currentlyWith}</span>
        ),
      },
    ],
    []
  );

  const openAddModal = () => {
    setEditingAsset(null);
    setAssetFormData(EMPTY_ASSET_FORM);
    setAssetFormBaseline(EMPTY_ASSET_FORM);
    setIsAssetModalOpen(true);
  };

  if (isLoading && !assets.length) return <PageSkeleton />;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      overview={{
        stats: [
          {
            id: 'total',
            label: 'Equipment',
            value: assets.length,
            icon: Wrench,
            variant: 'info',
          },
          {
            id: 'available',
            label: 'Available',
            value: assets.filter((a) => a.status === 'Available').length,
            icon: Wrench,
            variant: 'mint',
          },
          {
            id: 'inUse',
            label: 'In Use',
            value: assets.filter((a) => a.status === 'In Use').length,
            icon: Wrench,
            variant: 'apricot',
          },
        ],
        charts: [
          ...(statusChart.length
            ? [{ id: 'status', title: 'By status', type: 'donut', data: statusChart }]
            : []),
          ...(categoryChart.length
            ? [{ id: 'category', title: 'By category', type: 'bar', data: categoryChart }]
            : []),
        ],
      }}
      toolbar={
        <SearchInput
          placeholder="Search equipment..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!w-44 shrink min-w-[9rem]"
        />
      }
      toolbarActions={
        <Button size="sm" onClick={openAddModal}>
          <Plus size={14} /> Add Asset
        </Button>
      }
    >
      <DataTable
        columns={equipmentColumns}
        data={filteredAssets}
        onRowClick={openAssetEditor}
        getRowId={(row) => row._id}
        emptyTitle="No equipment found"
        emptyDescription="Try a different search or add a new asset."
      />

      <NexusModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        title={editingAsset ? 'Edit Equipment' : 'Add Equipment'}
        showFooter={false}
        width="max-w-3xl"
        footer={
          editingAsset ? (
            <ModalFooter>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={revertEquipmentEdits}
                disabled={!hasEquipmentEdits || saveAssetMutation.isPending}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="success"
                onClick={() => saveAssetMutation.mutate(assetFormData)}
                disabled={!hasEquipmentEdits || saveAssetMutation.isPending}
              >
                {saveAssetMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </ModalFooter>
          ) : null
        }
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editingAsset) saveAssetMutation.mutate(assetFormData);
          }}
        >
          <Input
            label="Name"
            value={assetFormData.name}
            onChange={(e) => setAssetFormData({ ...assetFormData, name: e.target.value })}
            icon={Wrench}
            required
          />
          <Input
            label="Description"
            value={assetFormData.description}
            onChange={(e) => setAssetFormData({ ...assetFormData, description: e.target.value })}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block tm-section-label mb-2">Category</label>
              <select
                className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm"
                value={assetFormData.category}
                onChange={(e) => setAssetFormData({ ...assetFormData, category: e.target.value })}
              >
                {ASSET_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block tm-section-label mb-2">Status</label>
              <select
                className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm"
                value={assetFormData.status}
                onChange={(e) => setAssetFormData({ ...assetFormData, status: e.target.value })}
              >
                {ASSET_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block tm-section-label mb-2">Currently With</label>
            <select
              className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm"
              value={assetFormData.currentlyWith}
              onChange={(e) => setAssetFormData({ ...assetFormData, currentlyWith: e.target.value })}
            >
              <option value="Office">Office</option>
              {users.map((u) => (
                <option key={u._id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          {!editingAsset && (
            <Button type="submit" disabled={saveAssetMutation.isPending}>
              {saveAssetMutation.isPending ? 'Saving...' : 'Add Asset'}
            </Button>
          )}
        </form>
      </NexusModal>
    </ListPageLayout>
  );
};

export default EquipmentPage;
