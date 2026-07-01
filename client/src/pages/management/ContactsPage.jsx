import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Contact } from 'lucide-react';
import ListPageLayout from '../../components/ui/ListPageLayout';
import PageSkeleton from '../../components/ui/PageSkeleton';
import SearchInput from '../../components/ui/SearchInput';
import { Button, Input, DataTable, Badge } from '../../components/ui/primitives';
import ContactMobileRow from '../../components/office/ContactMobileRow';
import {
  OFFICE_TABLE_COL,
  OFFICE_TABLE_PROPS,
  OfficeMetaCell,
} from '../../components/office/officeHubTableClasses';
import QueryErrorBanner, { getQueryErrorMessage } from '../../components/ui/QueryErrorBanner';
import { NexusModal, ModalFooter } from '../../components/ui/modals';;
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';

const EMPTY_CONTACT_FORM = { name: '', role: '', phone: '', email: '', notes: '' };

const ContactsPage = () => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState(EMPTY_CONTACT_FORM);
  const [formBaseline, setFormBaseline] = useState(EMPTY_CONTACT_FORM);
  const queryClient = useQueryClient();

  const {
    data: contacts = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => (await axios.get('/api/contacts')).data,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) =>
      editingContact
        ? axios.put(`/api/contacts/${editingContact._id}`, data)
        : axios.post('/api/contacts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsModalOpen(false);
      setEditingContact(null);
      setFormData(EMPTY_CONTACT_FORM);
    },
  });

  const hasContactEdits =
    isModalOpen && editingContact && !stableJsonEqual(formData, formBaseline);

  const { revert: revertContactEdits } = useUnsavedChanges({
    baseline: formBaseline,
    draft: formData,
    setDraft: setFormData,
    hasChanges: hasContactEdits,
    onSave: () => saveMutation.mutate(formData),
    enabled: false,
    isSaving: saveMutation.isPending,
  });

  const filtered = useMemo(
    () =>
      contacts.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.role || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q)
        );
      }),
    [contacts, search]
  );

  const openContactEditor = (contact) => {
    const loaded = {
      name: contact.name,
      role: contact.role,
      phone: contact.phone,
      email: contact.email || '',
      notes: contact.notes || '',
    };
    setEditingContact(contact);
    setFormData(loaded);
    setFormBaseline(cloneSnapshot(loaded));
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingContact(null);
    setFormData(EMPTY_CONTACT_FORM);
    setFormBaseline(EMPTY_CONTACT_FORM);
    setIsModalOpen(true);
  };

  const contactColumns = useMemo(
    () => [
      {
        header: 'Contact',
        sortKey: 'name',
        headerClassName: OFFICE_TABLE_COL.primary,
        cellClassName: OFFICE_TABLE_COL.primary,
        render: (row) => (
          <span
            className="block min-w-0 truncate office-hub-cell-primary"
            title={[row.name, row.notes].filter(Boolean).join(' — ')}
          >
            <span className="tm-data-primary">{row.name}</span>
            {row.notes ? (
              <span className="office-hub-cell-secondary font-medium"> · {row.notes}</span>
            ) : null}
          </span>
        ),
      },
      {
        header: 'Role',
        sortKey: 'role',
        headerClassName: OFFICE_TABLE_COL.badge,
        cellClassName: OFFICE_TABLE_COL.badge,
        render: (row) => (
          <Badge variant="info" className="max-w-full truncate" title={row.role}>
            {row.role}
          </Badge>
        ),
      },
      {
        header: 'Phone',
        sortKey: 'phone',
        headerClassName: OFFICE_TABLE_COL.meta,
        cellClassName: OFFICE_TABLE_COL.meta,
        render: (row) => <OfficeMetaCell value={row.phone} />,
      },
      {
        header: 'Email',
        sortKey: 'email',
        headerClassName: OFFICE_TABLE_COL.meta,
        cellClassName: OFFICE_TABLE_COL.meta,
        render: (row) => <OfficeMetaCell value={row.email} className="text-[var(--color-text-muted)] font-normal" />,
      },
    ],
    []
  );

  if (isLoading && !contacts.length) return <PageSkeleton />;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      overview={{
        stats: [
          {
            id: 'total',
            label: 'Contacts',
            value: contacts.length,
            icon: Contact,
            variant: 'info',
            info: 'All contacts in your directory.',
          },
          {
            id: 'withEmail',
            label: 'With Email',
            value: contacts.filter((c) => c.email).length,
            icon: Contact,
            variant: 'mint',
            info: 'Contacts that have an email address on file.',
          },
        ],
      }}
      toolbarFill
      searchBar={(
        <SearchInput
          variant="toolbar"
          placeholder="Search name, role, phone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-full"
        />
      )}
      toolbarActions={
        <Button size="sm" onClick={openAddModal}>
          <Plus size={14} /> Add Contact
        </Button>
      }
    >
      {isError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(error, 'Failed to load contacts')}
          onRetry={() => refetch()}
        />
      )}
      <DataTable
        columns={contactColumns}
        data={filtered}
        onRowClick={openContactEditor}
        getRowId={(row) => row._id}
        mobileRowRender={(row) => <ContactMobileRow contact={row} />}
        mobileRowClassName="!py-2.5 !px-3"
        emptyTitle="No contacts found"
        emptyDescription="Try a different search or add a new contact."
        {...OFFICE_TABLE_PROPS}
      />

      <NexusModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
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
                onClick={revertContactEdits}
                disabled={!hasContactEdits || saveMutation.isPending}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="success"
                onClick={() => saveMutation.mutate(formData)}
                disabled={!hasContactEdits || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </ModalFooter>
          ) : null
        }
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editingContact) saveMutation.mutate(formData);
          }}
        >
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            icon={Contact}
          />
          <Input
            label="Role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          />
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Email"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="Notes"
            multiline
            rows={3}
            autoGrow
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
          {!editingContact && (
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Add Contact'}
            </Button>
          )}
        </form>
      </NexusModal>
    </ListPageLayout>
  );
};

export default ContactsPage;
