import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Wrench, Plus } from 'lucide-react';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import ListPageLayout from '../../components/ui/ListPageLayout';
import ListPageSkeleton from '../../components/ui/ListPageSkeleton';
import SearchInput from '../../components/ui/SearchInput';
import { Button, Input, DataTable, Badge } from '../../components/ui/primitives';
import StatusBadge from '../../components/ui/StatusBadge';
import EquipmentMobileRow from '../../components/office/EquipmentMobileRow';
import {
  OFFICE_TABLE_COL,
  OFFICE_TABLE_PROPS,
  OfficePrimaryCell,
  OfficeMetaCell,
} from '../../components/office/officeHubTableClasses';
import QueryErrorBanner, { getQueryErrorMessage } from '../../components/ui/QueryErrorBanner';
import { NexusModal, ModalFooter } from '../../components/ui/modals';;
import { distributionFromField } from '../../utils/buildChartSeries';
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';

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

  const {
    data: assets = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['office-assets'],
    queryFn: async () => (await axios.get('/api/office-assets')).data,
  });
  const deferEquipmentSecondary = useDeferredQueryEnabled(!isLoading);
  const { data: users = [] } = useUserDirectory(deferEquipmentSecondary);

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
        headerClassName: OFFICE_TABLE_COL.primary,
        cellClassName: OFFICE_TABLE_COL.primary,
        render: (row) => (
          <OfficePrimaryCell title={row.name} subtitle={row.description || undefined} />
        ),
      },
      {
        header: 'Category',
        sortKey: 'category',
        headerClassName: OFFICE_TABLE_COL.badge,
        cellClassName: OFFICE_TABLE_COL.badge,
        render: (row) => (
          <StatusBadge role="neutral" className="max-w-full truncate" title={row.category}>
            {row.category}
          </StatusBadge>
        ),
      },
      {
        header: 'Status',
        sortKey: 'status',
        headerClassName: OFFICE_TABLE_COL.badge,
        cellClassName: OFFICE_TABLE_COL.badge,
        render: (row) => (
          <StatusBadge status={row.status} className="max-w-full truncate" title={row.status} />
        ),
      },
      {
        header: 'Assigned To',
        sortKey: 'currentlyWith',
        headerClassName: OFFICE_TABLE_COL.meta,
        cellClassName: OFFICE_TABLE_COL.meta,
        render: (row) => <OfficeMetaCell value={row.currentlyWith} />,
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

  if (isLoading && !assets.length) return <ListPageSkeleton statCount={3} />;

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
       
      }}
      toolbarFill
      searchBar={(
        <SearchInput
          variant="toolbar"
          placeholder="Search equipment name, category, assignee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-full"
        />
      )}
      toolbarActions={
        <Button size="sm" onClick={openAddModal}>
          <Plus size={14} /> Add Asset
        </Button>
      }
    >
      {isError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(error, 'Failed to load equipment')}
          onRetry={() => refetch()}
        />
      )}
      <DataTable
        columns={equipmentColumns}
        data={filteredAssets}
        onRowClick={openAssetEditor}
        getRowId={(row) => row._id}
        mobileRowRender={(row) => <EquipmentMobileRow asset={row} />}
        mobileRowClassName="!py-2.5 !px-3"
        emptyTitle="No equipment found"
        emptyDescription="Try a different search or add a new asset."
        {...OFFICE_TABLE_PROPS}
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
