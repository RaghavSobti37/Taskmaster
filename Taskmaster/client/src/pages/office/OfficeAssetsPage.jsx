import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Building2, Plus, Contact, Phone, Mail, Wrench } from 'lucide-react';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { Button, Input, Badge, TabSwitcher, SearchInput, DataTable, PageLoadGuard, PageSkeleton, ListPageLayout, StatusBadge } from '../../components/ui';
import { NexusModal, ModalFooter } from '../../components/ui/modals';;
import { distributionFromField } from '../../utils/buildChartSeries';
import { useConfirm } from '../../contexts/confirmContext';
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';
import EquipmentMobileRow from '../../components/office/EquipmentMobileRow';
import ContactMobileRow from '../../components/office/ContactMobileRow';
import {
  OFFICE_TABLE_COL,
  OFFICE_TABLE_PROPS,
  OfficePrimaryCell,
  OfficeMetaCell,
} from '../../components/office/officeHubTableClasses';

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

  const { data: assets = [], isLoading: assetsLoading, isError: assetsError, error: assetsErr, refetch: refetchAssets } = useQuery({
    queryKey: ['office-assets'],
    queryFn: async () => (await axios.get('/api/office-assets')).data
  });

  const deferOfficeSecondary = useDeferredQueryEnabled(!assetsLoading);
  const { data: users = [] } = useUserDirectory(deferOfficeSecondary);

  const { data: contacts = [], isLoading: contactsLoading, isError: contactsError, error: contactsErr, refetch: refetchContacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => (await axios.get('/api/contacts')).data,
    enabled: deferOfficeSecondary,
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

  const handleContactSubmit = (e) => {
    if (e) e.preventDefault();
    if (editingContact) return;
    saveContactMutation.mutate(contactFormData);
  };

  const hasOfficeAssetEdits =
    isAssetModalOpen && editingAsset && assetFormBaseline && !stableJsonEqual(assetFormData, assetFormBaseline);

  const hasOfficeContactEdits =
    isContactModalOpen && editingContact && contactFormBaseline && !stableJsonEqual(contactFormData, contactFormBaseline);

  const { revert: revertOfficeAssetEdits } = useUnsavedChanges({
    baseline: assetFormBaseline,
    draft: assetFormData,
    setDraft: setAssetFormData,
    hasChanges: hasOfficeAssetEdits,
    onSave: () => saveAssetMutation.mutate(assetFormData),
    enabled: false,
    isSaving: saveAssetMutation.isPending,
    fieldLabels: {
      name: 'Asset Name',
      description: 'Description',
      category: 'Category',
      status: 'Status',
      currentlyWith: 'Currently With',
      serialNumber: 'Serial Number',
      purchaseDate: 'Purchase Date',
    },
    excludeFields: ['updateNotes'],
  });

  const { revert: revertOfficeContactEdits } = useUnsavedChanges({
    baseline: contactFormBaseline,
    draft: contactFormData,
    setDraft: setContactFormData,
    hasChanges: hasOfficeContactEdits,
    onSave: () => handleContactSubmit(),
    enabled: false,
    isSaving: saveContactMutation.isPending,
  });

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    a.currentlyWith.toLowerCase().includes(search.toLowerCase())
  );

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.role.toLowerCase().includes(search.toLowerCase())
  );

  const openAssetRow = useCallback((asset) => {
    const loaded = {
      ...asset,
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
      updateNotes: '',
    };
    setEditingAsset(asset);
    setAssetFormData(loaded);
    setAssetFormBaseline(cloneSnapshot(loaded));
    setIsAssetModalOpen(true);
  }, []);

  const openContactRow = useCallback((contact) => {
    const loaded = {
      name: contact.name,
      role: contact.role,
      phone: contact.phone,
      email: contact.email || '',
      notes: contact.notes || '',
    };
    setEditingContact(contact);
    setContactFormData(loaded);
    setContactFormBaseline(cloneSnapshot(loaded));
    setIsContactModalOpen(true);
  }, []);

  const assetStatusChart = useMemo(
    () => distributionFromField(assets, 'status'),
    [assets]
  );

  const assetColumns = useMemo(
    () => [
      {
        header: 'Equipment',
        sortKey: 'name',
        headerClassName: OFFICE_TABLE_COL.primary,
        cellClassName: OFFICE_TABLE_COL.primary,
        render: (a) => (
          <OfficePrimaryCell title={a.name} subtitle={a.description || undefined} />
        ),
      },
      {
        header: 'Category',
        sortKey: 'category',
        headerClassName: OFFICE_TABLE_COL.badge,
        cellClassName: OFFICE_TABLE_COL.badge,
        render: (a) => (
          <StatusBadge role="neutral" className="max-w-full truncate" title={a.category}>
            {a.category}
          </StatusBadge>
        ),
      },
      {
        header: 'Status',
        sortKey: 'status',
        headerClassName: OFFICE_TABLE_COL.badge,
        cellClassName: OFFICE_TABLE_COL.badge,
        render: (a) => (
          <StatusBadge status={a.status} className="max-w-full truncate" title={a.status} />
        ),
      },
      {
        header: 'Assigned To',
        sortKey: 'currentlyWith',
        headerClassName: OFFICE_TABLE_COL.meta,
        cellClassName: OFFICE_TABLE_COL.meta,
        render: (a) => <OfficeMetaCell value={a.currentlyWith} />,
      },
      {
        header: 'Serial Number',
        sortKey: 'serialNumber',
        headerClassName: OFFICE_TABLE_COL.meta,
        cellClassName: OFFICE_TABLE_COL.meta,
        render: (a) => (
          <OfficeMetaCell
            value={a.serialNumber}
            className="tabular-nums text-[var(--color-text-muted)] font-normal"
          />
        ),
      },
    ],
    []
  );

  const contactColumns = useMemo(
    () => [
      {
        header: 'Contact',
        sortKey: 'name',
        headerClassName: OFFICE_TABLE_COL.primary,
        cellClassName: OFFICE_TABLE_COL.primary,
        render: (c) => (
          <span
            className="block min-w-0 truncate office-hub-cell-primary"
            title={[c.name, c.notes].filter(Boolean).join(' — ')}
          >
            <span className="tm-data-primary">{c.name}</span>
            {c.notes ? (
              <span className="office-hub-cell-secondary font-medium"> · {c.notes}</span>
            ) : null}
          </span>
        ),
      },
      {
        header: 'Role',
        sortKey: 'role',
        headerClassName: OFFICE_TABLE_COL.badge,
        cellClassName: OFFICE_TABLE_COL.badge,
        render: (c) => (
          <Badge variant="info" className="max-w-full truncate" title={c.role}>
            {c.role}
          </Badge>
        ),
      },
      {
        header: 'Phone',
        sortKey: 'phone',
        headerClassName: OFFICE_TABLE_COL.meta,
        cellClassName: OFFICE_TABLE_COL.meta,
        render: (c) => <OfficeMetaCell value={c.phone} />,
      },
      {
        header: 'Email',
        sortKey: 'email',
        headerClassName: OFFICE_TABLE_COL.meta,
        cellClassName: OFFICE_TABLE_COL.meta,
        render: (c) => <OfficeMetaCell value={c.email} className="text-[var(--color-text-muted)] font-normal" />,
      },
    ],
    []
  );

  const listLoading = activeTab === 'assets' ? assetsLoading : contactsLoading;
  const listIsError = activeTab === 'assets' ? assetsError : contactsError;
  const listError = activeTab === 'assets' ? assetsErr : contactsErr;
  const refetchList = () => (activeTab === 'assets' ? refetchAssets() : refetchContacts());
  const openAddAsset = () => {
    setEditingAsset(null);
    setAssetFormBaseline(null);
    setAssetFormData({ name: '', description: '', category: 'Hardware', currentlyWith: 'Office', status: 'Available', updateNotes: '', serialNumber: '', purchaseDate: '' });
    setIsAssetModalOpen(true);
  };

  const openAddContact = () => {
    setEditingContact(null);
    setContactFormBaseline(null);
    setContactFormData({ name: '', role: '', phone: '', email: '', notes: '' });
    setIsContactModalOpen(true);
  };

  return (
    <PageLoadGuard
      loading={listLoading && !(activeTab === 'assets' ? assets.length : contacts.length)}
      isError={listIsError}
      error={listError}
      onRetry={refetchList}
      queryErrorFallback="Failed to load office data"
      skeleton={PageSkeleton}
    >
    <ListPageLayout
      queryError={listIsError ? listError : null}
      onQueryRetry={refetchList}
      queryErrorFallback="Failed to load office data"
      containerClassName="!py-4"
      overview={{
        stats: [
          {
            id: 'assets',
            label: 'Office Assets',
            value: assets.length,
            icon: Building2,
            variant: 'info',
            onClick: () => setActiveTab('assets'),
            active: activeTab === 'assets',
          },
          {
            id: 'contacts',
            label: 'Contacts',
            value: contacts.length,
            icon: Contact,
            variant: 'mint',
            onClick: () => setActiveTab('contacts'),
            active: activeTab === 'contacts',
          },
        ],
        charts: assetStatusChart.length
          ? [{ id: 'assetStatus', title: 'Asset status', type: 'donut', data: assetStatusChart }]
          : [],
      }}
      toolbarFill
      searchBar={(
        <SearchInput
          variant="toolbar"
          placeholder={activeTab === 'assets' ? 'Search asset name, assignee…' : 'Search contact name, role…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-full"
        />
      )}
      toolbarActions={
        <>
          <TabSwitcher
            tabs={[
              { id: 'assets', label: `Assets (${assets.length})` },
              { id: 'contacts', label: `Contacts (${contacts.length})` },
            ]}
            activeTab={activeTab}
            onChange={(tabId) => { setActiveTab(tabId); setSearch(''); }}
          />
          {activeTab === 'assets' ? (
            <Button size="sm" onClick={openAddAsset}>
              <Plus size={14} /> Add Asset
            </Button>
          ) : (
            <Button size="sm" onClick={openAddContact}>
              <Plus size={14} /> Add Contact
            </Button>
          )}
        </>
      }
    >
      {activeTab === 'assets' ? (
        <DataTable
          columns={assetColumns}
          data={filteredAssets}
          onRowClick={openAssetRow}
          getRowId={(a) => a._id}
          isLoading={assetsLoading}
          mobileRowRender={(row) => <EquipmentMobileRow asset={row} />}
          mobileRowClassName="!py-2.5 !px-3"
          emptyTitle="No equipment found"
          emptyDescription="Try a different search or add a new asset."
          {...OFFICE_TABLE_PROPS}
        />
      ) : (
        <DataTable
          columns={contactColumns}
          data={filteredContacts}
          onRowClick={openContactRow}
          getRowId={(c) => c._id}
          isLoading={contactsLoading}
          mobileRowRender={(row) => <ContactMobileRow contact={row} />}
          mobileRowClassName="!py-2.5 !px-3"
          emptyTitle="No contacts found"
          emptyDescription="Try a different search or add a new contact."
          {...OFFICE_TABLE_PROPS}
        />
      )}

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
                onClick={revertOfficeAssetEdits}
                disabled={!hasOfficeAssetEdits || saveAssetMutation.isPending}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="success"
                onClick={() => saveAssetMutation.mutate(assetFormData)}
                disabled={!hasOfficeAssetEdits || saveAssetMutation.isPending}
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
                <option>Hardware</option>
                <option>Furniture</option>
                <option>Software</option>
                <option>Misc</option>
              </select>
            </div>
            <div>
              <label className="block tm-section-label mb-2">Status</label>
              <select
                className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm"
                value={assetFormData.status}
                onChange={(e) => setAssetFormData({ ...assetFormData, status: e.target.value })}
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
          <Input
            label="Serial Number"
            placeholder="e.g. SN-12345"
            value={assetFormData.serialNumber || ''}
            onChange={(e) => setAssetFormData({ ...assetFormData, serialNumber: e.target.value })}
          />
          <Input
            label="Purchase Date"
            type="date"
            value={assetFormData.purchaseDate || ''}
            onChange={(e) => setAssetFormData({ ...assetFormData, purchaseDate: e.target.value })}
          />
          {editingAsset && (
            <Input
              label="Update Notes"
              multiline
              rows={3}
              autoGrow
              placeholder="e.g., Handed to John"
              value={assetFormData.updateNotes || ''}
              onChange={(e) => setAssetFormData({ ...assetFormData, updateNotes: e.target.value })}
            />
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!editingAsset && (
              <Button type="submit" disabled={saveAssetMutation.isPending}>
                {saveAssetMutation.isPending ? 'Saving...' : 'Add Asset'}
              </Button>
            )}
            {editingAsset && (
              <Button
                type="button"
                variant="ghost"
                className="!text-rose-500 hover:!bg-rose-500/10"
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
          </div>
        </form>
      </NexusModal>

      <NexusModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        title={editingContact ? 'Edit Contact' : 'Add Contact'}
        showFooter={false}
        width="max-w-2xl"
        footer={
          editingContact ? (
            <ModalFooter>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={revertOfficeContactEdits}
                disabled={!hasOfficeContactEdits || saveContactMutation.isPending}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="success"
                onClick={() => handleContactSubmit()}
                disabled={!hasOfficeContactEdits || saveContactMutation.isPending}
              >
                {saveContactMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </ModalFooter>
          ) : null
        }
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editingContact) saveContactMutation.mutate(contactFormData);
          }}
        >
          <Input
            label="Name"
            value={contactFormData.name}
            onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
            icon={Contact}
            required
          />
          <Input
            label="Role"
            value={contactFormData.role}
            onChange={(e) => setContactFormData({ ...contactFormData, role: e.target.value })}
            required
          />
          <Input
            label="Phone"
            value={contactFormData.phone}
            onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
            icon={Phone}
            required
          />
          <Input
            label="Email"
            type="email"
            value={contactFormData.email || ''}
            onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
            icon={Mail}
          />
          <Input
            label="Notes"
            multiline
            rows={3}
            autoGrow
            value={contactFormData.notes || ''}
            onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!editingContact && (
              <Button type="submit" disabled={saveContactMutation.isPending}>
                {saveContactMutation.isPending ? 'Saving...' : 'Add Contact'}
              </Button>
            )}
            {editingContact && (
              <Button
                type="button"
                variant="ghost"
                className="!text-rose-500 hover:!bg-rose-500/10"
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
          </div>
        </form>
      </NexusModal>
    </ListPageLayout>
    </PageLoadGuard>
  );
};

export default OfficeAssetsPage;


// Performance Optimization: useCallback(eventHandler) memoization guard
