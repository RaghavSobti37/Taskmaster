import React, { useMemo, useState } from 'react';
import { FileText, Link2, Plus, ExternalLink, Download, Pencil, Trash2 } from 'lucide-react';
import { ORG_DOCUMENT_CATEGORIES } from '@shared/orgDocumentCategories';
import ListPageLayout from '../../components/ui/ListPageLayout';
import ListPageSkeleton from '../../components/ui/ListPageSkeleton';
import SearchInput from '../../components/ui/SearchInput';
import { Button, Badge, DataTable } from '../../components/ui/primitives';
import { IconButton } from '../../components/ui';
import QueryErrorBanner, { getQueryErrorMessage } from '../../components/ui/QueryErrorBanner';
import OrgDocumentModal from '../../components/management/OrgDocumentModal';
import { countActiveFilters } from '../../components/ui/selectionFilterUtils';
import { formatDisplayDate } from '../../utils/dateDisplay';
import { useConfirm } from '../../contexts/confirmContext';
import {
  useOrgDocuments,
  useCreateOrgDocument,
  useUpdateOrgDocument,
  useDeleteOrgDocument,
} from '../../hooks/useTaskmasterQueries';

const openExternalUrl = (url) => {
  const trimmed = String(url || '').trim();
  if (!trimmed) return;
  const href = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  window.open(href, '_blank', 'noopener,noreferrer');
};

const openFileDocument = (doc) => {
  if (!doc?._id) return;
  window.open(`/api/org-documents/${doc._id}/file`, '_blank', 'noopener,noreferrer');
};

export default function DocumentsPage() {
  const { confirm } = useConfirm();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);

  const apiFilters = useMemo(() => {
    const params = {};
    if (categoryFilter !== 'all') params.category = categoryFilter;
    if (tagFilter !== 'all') params.tag = tagFilter;
    if (search.trim()) params.q = search.trim();
    return params;
  }, [categoryFilter, tagFilter, search]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useOrgDocuments(apiFilters);

  const documents = data?.data || [];
  const createDoc = useCreateOrgDocument();
  const updateDoc = useUpdateOrgDocument();
  const deleteDoc = useDeleteOrgDocument();

  const allTags = useMemo(() => {
    const tags = new Set();
    documents.forEach((doc) => (doc.tags || []).forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [documents]);

  const stats = useMemo(() => ({
    total: documents.length,
    files: documents.filter((d) => d.sourceType === 'file').length,
    links: documents.filter((d) => d.sourceType === 'link').length,
  }), [documents]);

  const filterFields = useMemo(() => [
    {
      id: 'category',
      label: 'Category',
      type: 'radio',
      value: categoryFilter,
      defaultValue: 'all',
      options: [
        { value: 'all', label: 'All categories' },
        ...ORG_DOCUMENT_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
      ],
      onChange: setCategoryFilter,
    },
    {
      id: 'tag',
      label: 'Tag',
      type: 'radio',
      value: tagFilter,
      defaultValue: 'all',
      options: [
        { value: 'all', label: 'All tags' },
        ...allTags.map((tag) => ({ value: tag, label: tag })),
      ],
      onChange: setTagFilter,
    },
  ], [categoryFilter, tagFilter, allTags]);

  const handleClearFilters = () => {
    setCategoryFilter('all');
    setTagFilter('all');
  };

  const openCreate = () => {
    setEditingDoc(null);
    setModalOpen(true);
  };

  const openEdit = (doc) => {
    setEditingDoc(doc);
    setModalOpen(true);
  };

  const handleDelete = async (doc) => {
    const ok = await confirm({
      title: 'Delete document?',
      message: `Remove "${doc.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    deleteDoc.mutate(doc._id);
  };

  const handleOpen = (doc) => {
    if (doc.sourceType === 'link') openExternalUrl(doc.externalUrl);
    else openFileDocument(doc);
  };

  const columns = useMemo(() => [
    {
      id: 'title',
      key: 'title',
      header: 'Title',
      mobilePrimary: true,
      sortKey: 'title',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{row.title}</p>
          {row.description && (
            <p className="text-xs text-[var(--color-text-muted)] truncate">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      id: 'category',
      key: 'category',
      header: 'Category',
      sortKey: 'category',
      render: (row) => <Badge variant="neutral">{row.category || 'Other'}</Badge>,
    },
    {
      id: 'type',
      key: 'sourceType',
      header: 'Type',
      sortKey: 'sourceType',
      render: (row) => (
        <Badge variant={row.sourceType === 'file' ? 'info' : 'mint'}>
          {row.sourceType === 'file' ? 'File' : 'Link'}
        </Badge>
      ),
    },
    {
      id: 'uploadedBy',
      key: 'uploadedBy',
      header: 'Uploaded by',
      render: (row) => row.uploadedBy?.name || '—',
    },
    {
      id: 'date',
      key: 'createdAt',
      header: 'Date',
      sortKey: 'createdAt',
      render: (row) => formatDisplayDate(row.createdAt),
    },
    {
      id: 'actions',
      header: '',
      mobileAction: true,
      className: 'w-[120px]',
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <IconButton
            label={row.sourceType === 'link' ? 'Open link' : 'Download'}
            onClick={() => handleOpen(row)}
          >
            {row.sourceType === 'link' ? <ExternalLink size={14} /> : <Download size={14} />}
          </IconButton>
          <IconButton label="Edit" onClick={() => openEdit(row)}>
            <Pencil size={14} />
          </IconButton>
          <IconButton label="Delete" onClick={() => handleDelete(row)}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      ),
    },
  ], []);

  const isSaving = createDoc.isPending || updateDoc.isPending;

  if (isLoading) {
    return <ListPageSkeleton statCount={3} rowCount={6} />;
  }

  return (
    <>
      <ListPageLayout
        containerClassName="!py-4"
        overview={{
          stats: [
            {
              id: 'total',
              label: 'Total',
              value: stats.total,
              icon: FileText,
              variant: 'info',
            },
            {
              id: 'files',
              label: 'Files',
              value: stats.files,
              icon: FileText,
              variant: 'mint',
            },
            {
              id: 'links',
              label: 'Links',
              value: stats.links,
              icon: Link2,
              variant: 'apricot',
            },
          ],
        }}
        filterFields={filterFields}
        filterSheetTitle="Document filters"
        mobileFilterCount={countActiveFilters(filterFields)}
        onActiveFiltersClear={handleClearFilters}
        toolbarFill
        searchBar={(
          <SearchInput
            variant="toolbar"
            placeholder="Search title, description, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-full"
          />
        )}
        toolbarActions={(
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} /> Add document
          </Button>
        )}
        queryError={isError ? error : null}
        queryErrorFallback="Failed to load documents"
        onQueryRetry={() => refetch()}
      >
        {isError && (
          <QueryErrorBanner
            message={getQueryErrorMessage(error, 'Failed to load documents')}
            onRetry={() => refetch()}
          />
        )}
        <DataTable
          columns={columns}
          data={documents}
          onRowClick={handleOpen}
          getRowId={(row) => row._id}
          emptyTitle="No documents yet"
          emptyDescription="Add important org files or links for ops and admin."
        />
      </ListPageLayout>

      <OrgDocumentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingDoc={editingDoc}
        isSaving={isSaving}
        onSaveLink={async (payload) => {
          if (payload.id) {
            await updateDoc.mutateAsync(payload);
          } else {
            await createDoc.mutateAsync(payload);
          }
        }}
        onSaveFile={async (payload) => {
          await createDoc.mutateAsync(payload);
        }}
      />
    </>
  );
}
