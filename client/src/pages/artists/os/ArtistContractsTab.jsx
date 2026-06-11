import React, { useState } from 'react';
import { Badge, DataTable, Button, Input } from '../../../components/ui';
import ArtistOsQueryShell from './ArtistOsQueryShell';
import { NexusModal } from '../../../components/ui/modals';
import { Plus } from 'lucide-react';
import { useArtistOsContracts, useCreateArtistContract } from '../../../hooks/queries/artistOs';

const EMPTY = { title: '', status: 'draft', documentUrl: '' };

export default function ArtistContractsTab({ artistId, isPreview }) {
  const { data: contracts = [], isLoading, isError, error, refetch } = useArtistOsContracts(artistId, !!artistId && !isPreview);
  const createMutation = useCreateArtistContract();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const columns = [
    { header: 'Title', render: (row) => <span className="text-xs font-bold">{row.title}</span> },
    { header: 'Status', render: (row) => <Badge variant={row.status === 'signed' ? 'success' : 'info'}>{row.status}</Badge> },
    {
      header: 'Document',
      render: (row) => row.documentUrl ? (
        <a href={row.documentUrl} target="_blank" rel="noreferrer" className="text-xs text-[var(--color-action-primary)] underline">View</a>
      ) : '—',
    },
  ];

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title) return alert('Title required');
    await createMutation.mutateAsync({ artistId, data: form });
    setOpen(false);
    setForm(EMPTY);
  };

  return (
    <ArtistOsQueryShell isLoading={isLoading} isError={isError} error={error} refetch={refetch} isPreview={isPreview}>
      {!isPreview && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Add Contract</Button>
        </div>
      )}
      <DataTable columns={columns} data={contracts} emptyTitle="No contracts" />
      <NexusModal isOpen={open} onClose={() => setOpen(false)} title="Add Contract" showFooter={false}>
        <form onSubmit={submit} className="space-y-3">
          <Input label="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Document URL" value={form.documentUrl} onChange={(e) => setForm({ ...form, documentUrl: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>
      </NexusModal>
    </ArtistOsQueryShell>
  );
}
